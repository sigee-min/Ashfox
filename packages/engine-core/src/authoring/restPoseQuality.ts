import type { ProjectDocument } from '../model';
import {
  readCompiledParts,
  type CompiledPartState
} from '../modeling/partInvariants';
import { parseCellKey } from '../modeling/lattice';
import { readPartRecipe } from '../modeling/partRecipe';
import { measureStaticSupport } from '../modeling/staticSupportMetric';
import type { CellKey } from '../modeling/types';
import { compareStableText } from '../stableOrder';
import { authoringPlanIssue } from './authoringIssueFactories';
import type { AuthoringPlanIssue } from './authoringPlanTypes';
import type {
  AuthoringProfile,
  AuthoringRestPoseMode,
  AuthoringSlotAssignment,
  AuthoringSupport
} from './authoringTypes';

const EPSILON = 0.000001;

export const CANONICAL_STANDING_EXTENSION_POLICY = Object.freeze({
  minimumVerticalDropCells: 1,
  minimumVerticalPathFraction: 0.5,
  minimumCoreCentroidClearanceCells: 1
});

type Point2 = readonly [number, number];
type Point3 = readonly [number, number, number];

export type RestPoseQualityState = 'incomplete' | 'invalid' | 'complete';

export interface RestPoseQualityStatus {
  kind: 'canonical-neutral';
  mode: AuthoringRestPoseMode;
  state: RestPoseQualityState;
  coreSlotId: string | null;
  supportSlotIds: readonly string[];
  groundContactPartIds: readonly string[];
  nonSupportGroundContactPartIds: readonly string[];
  invalidHierarchyPartIds: readonly string[];
  invalidDescentPartIds: readonly string[];
  coreAboveSupport: boolean | null;
  centerOfMassSupported: boolean | null;
}

export interface RestPoseQualityEvaluation {
  status: RestPoseQualityStatus;
  issues: readonly AuthoringPlanIssue[];
  /** Existing materialized geometry that violates canonical neutral rest. */
  violations: readonly AuthoringPlanIssue[];
  ready: boolean;
}

interface MutableEvaluation {
  issues: AuthoringPlanIssue[];
  violations: AuthoringPlanIssue[];
}

const addIssue = (
  evaluation: MutableEvaluation,
  issue: AuthoringPlanIssue,
  violation: boolean
): void => {
  evaluation.issues.push(issue);
  if (violation) evaluation.violations.push(issue);
};

const cellsForParts = (
  partIds: readonly string[],
  parts: ReadonlyMap<string, CompiledPartState>
): ReadonlySet<CellKey> => new Set(partIds.flatMap((partId) => [
  ...(parts.get(partId)?.occupancy.cells ?? [])
]));

const centroid = (cells: ReadonlySet<CellKey>): Point3 | null => {
  if (cells.size === 0) return null;
  const sum = [...cells].reduce((current, key) => {
    const cell = parseCellKey(key);
    return [
      current[0] + cell.x + 0.5,
      current[1] + cell.y + 0.5,
      current[2] + cell.z + 0.5
    ] as Point3;
  }, [0, 0, 0] as Point3);
  return [sum[0] / cells.size, sum[1] / cells.size, sum[2] / cells.size];
};

const cross = (origin: Point2, first: Point2, second: Point2): number =>
  (first[0] - origin[0]) * (second[1] - origin[1]) -
  (first[1] - origin[1]) * (second[0] - origin[0]);

const pointOnSegment = (
  point: Point2,
  start: Point2,
  end: Point2
): boolean =>
  Math.abs(cross(start, end, point)) <= EPSILON &&
  point[0] >= Math.min(start[0], end[0]) - EPSILON &&
  point[0] <= Math.max(start[0], end[0]) + EPSILON &&
  point[1] >= Math.min(start[1], end[1]) - EPSILON &&
  point[1] <= Math.max(start[1], end[1]) + EPSILON;

const pointInsideHull = (
  point: Point2,
  hull: readonly Point2[]
): boolean => {
  if (hull.length === 0) return false;
  if (hull.length === 1) {
    return Math.abs(point[0] - hull[0][0]) <= EPSILON &&
      Math.abs(point[1] - hull[0][1]) <= EPSILON;
  }
  if (hull.length === 2) return pointOnSegment(point, hull[0], hull[1]);
  return hull.every((vertex, index) =>
    cross(vertex, hull[(index + 1) % hull.length], point) >= -EPSILON
  );
};

const expectedSupportSlots = (
  profile: AuthoringProfile
): readonly AuthoringSlotAssignment[] => {
  switch (profile.restPose.mode) {
    case 'standing':
      return profile.slots.filter((slot) => slot.support.kind === 'foot');
    case 'supported':
      return profile.slots.filter((slot) => slot.support.kind === 'base');
    case 'rolling':
      return profile.slots.filter((slot) => slot.support.kind === 'wheel');
    case 'airborne':
    case 'free':
      return [];
  }
};

/** Parts whose downward-facing occupancy is allowed to own ground contact. */
const supportContactPartIds = (
  support: AuthoringSupport
): readonly string[] => {
  if (support.kind === 'none') return [];
  if (support.kind === 'base') return support.supportPartIds;
  if (support.kind === 'wheel') return support.wheelPartIds;
  return [
    ...support.solePartIds,
    ...support.digits.flatMap((digit) => [
      ...digit.toePartIds,
      ...digit.clawPartIds
    ])
  ];
};

const supportContractIsConsistent = (
  profile: AuthoringProfile
): boolean => {
  const feet = profile.slots.filter((slot) => slot.support.kind === 'foot');
  const bases = profile.slots.filter((slot) => slot.support.kind === 'base');
  const wheels = profile.slots.filter((slot) => slot.support.kind === 'wheel');
  const groundedFeet = feet.filter(
    (slot) => slot.support.kind === 'foot' &&
      slot.support.contact === 'grounded'
  );
  const groundedBases = bases.filter(
    (slot) => slot.support.kind === 'base' &&
      slot.support.contact === 'grounded'
  );
  const groundedWheels = wheels.filter(
    (slot) => slot.support.kind === 'wheel' &&
      slot.support.contact === 'grounded'
  );
  switch (profile.restPose.mode) {
    case 'standing':
      return feet.length > 0 &&
        groundedFeet.length === feet.length &&
        bases.length === 0 && wheels.length === 0;
    case 'rolling':
      return wheels.length > 0 &&
        groundedWheels.length === wheels.length &&
        feet.length === 0 && bases.length === 0;
    case 'supported':
      return bases.length > 0 &&
        groundedBases.length === bases.length &&
        feet.length === 0 && wheels.length === 0;
    case 'airborne':
    case 'free':
      return groundedFeet.length === 0 && groundedBases.length === 0 &&
        groundedWheels.length === 0;
  }
};

const chainToCore = (
  partId: string,
  corePartIds: ReadonlySet<string>,
  parts: ReadonlyMap<string, CompiledPartState>
): readonly CompiledPartState[] | null => {
  const chain: CompiledPartState[] = [];
  const visited = new Set<string>();
  let current = parts.get(partId);
  while (current && !visited.has(current.partId)) {
    chain.push(current);
    if (corePartIds.has(current.partId)) return chain.reverse();
    visited.add(current.partId);
    current = current.parentPartId === null
      ? undefined
      : parts.get(current.parentPartId);
  }
  return null;
};

const chainDescends = (chain: readonly CompiledPartState[]): boolean => {
  const centers = chain.map((part) => centroid(part.occupancy.cells));
  if (centers.some((center) => center === null)) return false;
  const concrete = centers as readonly Point3[];
  const first = concrete[0];
  const last = concrete.at(-1)!;
  const verticalDrop = first[1] - last[1];
  const totalPathLength = concrete.slice(1).reduce((length, point, index) => {
    const previous = concrete[index];
    return length + Math.hypot(
      point[0] - previous[0],
      point[1] - previous[1],
      point[2] - previous[2]
    );
  }, 0);
  const policy = CANONICAL_STANDING_EXTENSION_POLICY;
  return verticalDrop >= policy.minimumVerticalDropCells - EPSILON &&
    totalPathLength > EPSILON &&
    verticalDrop / totalPathLength >=
      policy.minimumVerticalPathFraction - EPSILON &&
    concrete.every((center, index) =>
      index === 0 || center[1] <= concrete[index - 1][1] + EPSILON
    );
};

const emptyStatus = (
  profile: AuthoringProfile,
  state: RestPoseQualityState
): RestPoseQualityStatus => ({
  kind: 'canonical-neutral',
  mode: profile.restPose.mode,
  state,
  coreSlotId: null,
  supportSlotIds: [],
  groundContactPartIds: [],
  nonSupportGroundContactPartIds: [],
  invalidHierarchyPartIds: [],
  invalidDescentPartIds: [],
  coreAboveSupport: null,
  centerOfMassSupported: null
});

interface GroundContractResult {
  groundContactPartIds: readonly string[];
  nonSupportGroundContactPartIds: readonly string[];
}

const evaluateGroundContract = (
  profile: AuthoringProfile,
  supportIds: ReadonlySet<string>,
  parts: ReadonlyMap<string, CompiledPartState>,
  evaluation: MutableEvaluation
): GroundContractResult => {
  const groundContactPartIds = [...parts.values()]
    .filter((part) => [...part.occupancy.cells].some(
      (key) => parseCellKey(key).y === 0
    ))
    .map((part) => part.partId)
    .sort(compareStableText);
  const groundedMode = profile.restPose.mode === 'standing' ||
    profile.restPose.mode === 'rolling' ||
    profile.restPose.mode === 'supported';
  const nonSupportGroundContactPartIds = groundedMode
    ? groundContactPartIds.filter((partId) => !supportIds.has(partId))
    : [];
  if (nonSupportGroundContactPartIds.length > 0) {
    addIssue(evaluation, authoringPlanIssue(
      'authoring.plan.rest_pose_ground_contact_invalid',
      'modeling.parts',
      'Canonical grounded rest has y=0 contact outside declared support regions.',
      'only declared grounded foot, wheel, or base support parts may own lattice y=0 cells',
      { partIds: nonSupportGroundContactPartIds }
    ), true);
  }
  const forbidden = profile.restPose.mode === 'airborne'
    ? (y: number): boolean => y <= 0
    : (y: number): boolean => y < 0;
  const unclearedPartIds = [...parts.values()]
    .filter((part) => [...part.occupancy.cells].some(
      (key) => forbidden(parseCellKey(key).y)
    ))
    .map((part) => part.partId)
    .sort(compareStableText);
  if (unclearedPartIds.length > 0) {
    addIssue(evaluation, authoringPlanIssue(
      'authoring.plan.rest_pose_clearance_invalid',
      'modeling.parts',
      profile.restPose.mode === 'airborne'
        ? 'Canonical airborne rest must remain strictly above lattice ground.'
        : `Canonical ${profile.restPose.mode} rest penetrates below lattice ground.`,
      profile.restPose.mode === 'airborne'
        ? 'every compiled occupancy cell at lattice y>0'
        : profile.restPose.mode === 'free'
          ? 'free rest may touch the y=0 reference plane but every compiled cell must remain at lattice y>=0'
          : 'every compiled occupancy cell at lattice y>=0',
      { partIds: unclearedPartIds }
    ), true);
  }
  return { groundContactPartIds, nonSupportGroundContactPartIds };
};

interface StandingHierarchyResult {
  invalidHierarchyPartIds: readonly string[];
  invalidDescentPartIds: readonly string[];
}

const coreHasStandingClearance = (
  coreSlot: AuthoringSlotAssignment,
  supportIds: ReadonlySet<string>,
  parts: ReadonlyMap<string, CompiledPartState>
): boolean => {
  const coreCenter = centroid(cellsForParts(coreSlot.partIds, parts));
  const supportCells = cellsForParts([...supportIds], parts);
  if (!coreCenter || supportCells.size === 0) return false;
  const supportTop = Math.max(
    ...[...supportCells].map((key) => parseCellKey(key).y + 1)
  );
  return coreCenter[1] - supportTop >=
    CANONICAL_STANDING_EXTENSION_POLICY.minimumCoreCentroidClearanceCells -
      EPSILON;
};

const evaluateStandingHierarchy = (
  profile: AuthoringProfile,
  coreSlot: AuthoringSlotAssignment | undefined,
  supportSlots: readonly AuthoringSlotAssignment[],
  supportIds: ReadonlySet<string>,
  presentIds: ReadonlySet<string>,
  parts: ReadonlyMap<string, CompiledPartState>,
  evaluation: MutableEvaluation
): StandingHierarchyResult => {
  if (profile.restPose.mode !== 'standing' || !coreSlot) {
    return { invalidHierarchyPartIds: [], invalidDescentPartIds: [] };
  }
  const invalidHierarchyPartIds: string[] = [];
  const invalidDescentPartIds: string[] = [];
  const coreComplete = coreSlot.partIds.every((partId) => presentIds.has(partId));
  const coreIds = new Set(coreSlot.partIds);
  for (const slot of supportSlots) {
    if (
      slot.support.kind !== 'foot' ||
      !presentIds.has(slot.support.rootPartId) ||
      !coreComplete
    ) {
      continue;
    }
    const chain = chainToCore(slot.support.rootPartId, coreIds, parts);
    if (!chain) invalidHierarchyPartIds.push(slot.support.rootPartId);
    else if (!chainDescends(chain)) {
      invalidDescentPartIds.push(slot.support.rootPartId);
    }
  }
  const supportComplete = [...supportIds].every((partId) => presentIds.has(partId));
  if (
    coreComplete &&
    supportComplete &&
    !coreHasStandingClearance(coreSlot, supportIds, parts)
  ) {
    invalidDescentPartIds.push(...coreSlot.partIds);
  }
  if (invalidHierarchyPartIds.length > 0) {
    addIssue(evaluation, authoringPlanIssue(
      'authoring.plan.rest_pose_hierarchy_invalid',
      'authoringProfile.restPose',
      'Standing foot roots do not descend through the canonical core hierarchy.',
      'every grounded foot root must have a compiled parent chain reaching the root core',
      { partIds: invalidHierarchyPartIds }
    ), true);
  }
  if (invalidDescentPartIds.length > 0) {
    addIssue(evaluation, authoringPlanIssue(
      'authoring.plan.rest_pose_descent_invalid',
      'authoringProfile.restPose',
      'Standing core-to-foot chains do not realize canonical vertical extension.',
      'non-rising chains whose vertical drop covers at least half of centroid-chain length and leaves the core centroid at least one cell above support-top; lateral exterior ports are validated separately by exact bilateral reflection',
      { partIds: invalidDescentPartIds }
    ), true);
  }
  return {
    invalidHierarchyPartIds: invalidHierarchyPartIds.sort(compareStableText),
    invalidDescentPartIds: [...new Set(invalidDescentPartIds)]
      .sort(compareStableText)
  };
};

interface GroundedBalanceResult {
  coreAboveSupport: boolean | null;
  centerOfMassSupported: boolean | null;
}

const evaluateGroundedBalance = (
  profile: AuthoringProfile,
  coreSlot: AuthoringSlotAssignment | undefined,
  supportIds: ReadonlySet<string>,
  presentIds: ReadonlySet<string>,
  missingIds: readonly string[],
  allCells: ReadonlySet<CellKey>,
  parts: ReadonlyMap<string, CompiledPartState>,
  evaluation: MutableEvaluation
): GroundedBalanceResult => {
  const groundedMode = profile.restPose.mode === 'standing' ||
    profile.restPose.mode === 'rolling' ||
    profile.restPose.mode === 'supported';
  const inputsComplete = groundedMode && coreSlot !== undefined &&
    coreSlot.partIds.every((partId) => presentIds.has(partId)) &&
    [...supportIds].every((partId) => presentIds.has(partId));
  if (!inputsComplete || !coreSlot) {
    return { coreAboveSupport: null, centerOfMassSupported: null };
  }
  const declaredSupportMetric = measureStaticSupport(
    cellsForParts([...supportIds], parts)
  );
  const wholeMetric = measureStaticSupport(allCells);
  const coreCenter = centroid(cellsForParts(coreSlot.partIds, parts));
  const coreAboveSupport = coreCenter !== null &&
    coreCenter[1] > EPSILON &&
    pointInsideHull(
      [coreCenter[0], coreCenter[2]],
      declaredSupportMetric.supportHull
    );
  const centerOfMassSupported = wholeMetric.centerOfMass !== null &&
    pointInsideHull(
      wholeMetric.centerOfMass,
      declaredSupportMetric.supportHull
    );
  if (!coreAboveSupport || (missingIds.length === 0 && !centerOfMassSupported)) {
    addIssue(evaluation, authoringPlanIssue(
      'authoring.plan.rest_pose_balance_invalid',
      'authoringProfile.restPose',
      !coreAboveSupport
        ? 'Canonical core is not vertically above the declared support hull.'
        : 'Canonical uniform-volume center of mass falls outside the declared support hull.',
      'core and completed-model center of mass projected inside the declared grounded support hull, with core above lattice ground',
      { partIds: coreSlot.partIds }
    ), missingIds.length === 0 || !coreAboveSupport);
  }
  return { coreAboveSupport, centerOfMassSupported };
};

export const evaluateRestPoseQuality = (
  document: ProjectDocument,
  profile: AuthoringProfile
): RestPoseQualityEvaluation => {
  const evaluation: MutableEvaluation = { issues: [], violations: [] };
  const recipe = readPartRecipe(document);
  if (!recipe.ok || !recipe.recipe) {
    const issue = authoringPlanIssue(
      recipe.ok
        ? 'authoring.plan.rest_pose_incomplete'
        : 'authoring.plan.rest_pose_evaluation_unavailable',
      recipe.ok ? 'modeling.parts' : recipe.issues[0]?.path ?? 'modeling',
      recipe.ok
        ? 'Canonical neutral rest pose is not materialized.'
        : recipe.issues[0]?.message ??
          'Canonical neutral rest pose cannot be evaluated.',
      'a complete valid PartRecipe authored in canonical neutral rest'
    );
    addIssue(evaluation, issue, !recipe.ok);
    return {
      status: emptyStatus(profile, recipe.ok ? 'incomplete' : 'invalid'),
      issues: evaluation.issues,
      violations: evaluation.violations,
      ready: false
    };
  }
  const compiled = readCompiledParts(document);
  if (!compiled.ok) {
    const issue = authoringPlanIssue(
      'authoring.plan.rest_pose_evaluation_unavailable',
      compiled.issues[0]?.path ?? 'scene.parts',
      compiled.issues[0]?.message ??
        'Canonical neutral rest pose cannot be evaluated from compiled geometry.',
      'valid compiler-owned canonical occupancy'
    );
    addIssue(evaluation, issue, true);
    return {
      status: emptyStatus(profile, 'invalid'),
      issues: evaluation.issues,
      violations: evaluation.violations,
      ready: false
    };
  }

  const coreSlot = profile.slots.find(
    (slot) => slot.parentSlotIds.length === 0 &&
      slot.structuralRole === 'core'
  );
  const supportSlots = expectedSupportSlots(profile);
  const supportIds = new Set(
    supportSlots.flatMap((slot) => supportContactPartIds(slot.support))
  );
  const allCells = new Set(
    [...compiled.parts.values()].flatMap((part) => [...part.occupancy.cells])
  );
  const presentIds = new Set(recipe.recipe.parts.map((part) => part.partId));
  const declaredIds = [
    ...profile.slots.flatMap((slot) => slot.partIds),
    ...profile.bindings.flatMap((binding) =>
      binding.type === 'attachment' ? binding.partIds : []
    )
  ];
  const missingIds = [...new Set(declaredIds)]
    .filter((partId) => !presentIds.has(partId))
    .sort(compareStableText);
  if (missingIds.length > 0) {
    addIssue(evaluation, authoringPlanIssue(
      'authoring.plan.rest_pose_incomplete',
      'modeling.parts',
      'Canonical neutral rest pose is missing declared authority parts.',
      'materialize every declared part before canonical rest review',
      { partIds: missingIds }
    ), false);
  }
  if (!supportContractIsConsistent(profile)) {
    addIssue(evaluation, authoringPlanIssue(
      'authoring.plan.rest_pose_support_invalid',
      'authoringProfile.restPose',
      `Canonical ${profile.restPose.mode} mode contradicts typed support contact.`,
      'standing with every foot grounded, rolling with every wheel grounded, supported with every base grounded, or no grounded support for airborne/free'
    ), true);
  }

  const ground = evaluateGroundContract(
    profile,
    supportIds,
    compiled.parts,
    evaluation
  );
  const standing = evaluateStandingHierarchy(
    profile,
    coreSlot,
    supportSlots,
    supportIds,
    presentIds,
    compiled.parts,
    evaluation
  );
  const balance = evaluateGroundedBalance(
    profile,
    coreSlot,
    supportIds,
    presentIds,
    missingIds,
    allCells,
    compiled.parts,
    evaluation
  );

  const state: RestPoseQualityState = evaluation.violations.length > 0
    ? 'invalid'
    : missingIds.length > 0 || evaluation.issues.length > 0
      ? 'incomplete'
      : 'complete';
  const status: RestPoseQualityStatus = {
    kind: 'canonical-neutral',
    mode: profile.restPose.mode,
    state,
    coreSlotId: coreSlot?.slotId ?? null,
    supportSlotIds: supportSlots.map((slot) => slot.slotId).sort(compareStableText),
    groundContactPartIds: ground.groundContactPartIds,
    nonSupportGroundContactPartIds:
      ground.nonSupportGroundContactPartIds,
    invalidHierarchyPartIds: standing.invalidHierarchyPartIds,
    invalidDescentPartIds: standing.invalidDescentPartIds,
    coreAboveSupport: balance.coreAboveSupport,
    centerOfMassSupported: balance.centerOfMassSupported
  };
  return {
    status,
    issues: evaluation.issues,
    violations: evaluation.violations,
    ready: state === 'complete'
  };
};
