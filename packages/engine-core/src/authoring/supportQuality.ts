import type { ProjectDocument } from '../model';
import { readCompiledParts } from '../modeling/partInvariants';
import { projectSpatialFrame } from '../project/projectSpatialFrame';
import { compareStableText } from '../stableOrder';
import { validateSupportPairReflections } from './supportPairReflection';
import {
  SUPPORT_QUALITY_EPSILON as EPSILON,
  addSupportQualityIssue as addIssue,
  belowGroundCellCount,
  cellsForParts,
  duplicateValues,
  environmentWithout,
  exposedCellCount,
  groundContactCellCount,
  isStrictDescendant,
  minimumMargin,
  supportDot as dot,
  supportPartIds,
  supportQualityIssue as issue,
  supportRegionMetrics as regionMetrics
} from './supportQualityGeometry';
import type {
  AuthoringFootDigit,
  AuthoringProfile,
  AuthoringSlotAssignment,
  AuthoringSupport
} from './authoringTypes';
import type {
  MutableSupportEvaluation as MutableEvaluation,
  SupportEvaluationContext as EvaluationContext,
  SupportQualityEvaluation,
  SupportQualityIssue,
  SupportQualityStatus,
  SupportRegionMetrics as RegionMetrics
} from './supportQualityTypes';

export type {
  SupportQualityEvaluation,
  SupportQualityIssue,
  SupportQualityIssueCode,
  SupportQualityState,
  SupportQualityStatus
} from './supportQualityTypes';

const statusForNone = (
  slot: AuthoringSlotAssignment
): SupportQualityStatus => ({
  slotId: slot.slotId,
  supportKind: 'none',
  contact: null,
  state: 'not-applicable',
  referencedPartIds: [],
  missingPartIds: [],
  groundContactCellCount: 0,
  downwardExposedSoleCellCount: 0,
  toeForwardMarginCells: null,
  clawForwardMarginCells: null,
  issueCodes: []
});

const validateSupportReferences = (
  slot: AuthoringSlotAssignment,
  context: EvaluationContext,
  evaluation: MutableEvaluation
): {
  referencedPartIds: readonly string[];
  missingPartIds: readonly string[];
  valid: boolean;
} => {
  const referencedPartIds = supportPartIds(slot.support);
  const owned = new Set(slot.partIds);
  const unowned = referencedPartIds.filter((partId) => !owned.has(partId));
  if (unowned.length > 0) {
    addIssue(evaluation, issue(
      'authoring.plan.support_part_unowned',
      `authoringProfile.slots.${slot.slotId}.support`,
      `Support contract for slot "${slot.slotId}" references parts outside the slot.`,
      'support regions using only part IDs owned by this slot',
      unowned
    ), true);
  }
  const duplicates = duplicateValues(referencedPartIds);
  if (duplicates.length > 0) {
    addIssue(evaluation, issue(
      'authoring.plan.support_part_duplicated',
      `authoringProfile.slots.${slot.slotId}.support`,
      `Support contract for slot "${slot.slotId}" assigns one part to multiple semantic regions.`,
      'disjoint root, sole, toe, and claw part ownership',
      duplicates
    ), true);
  }
  const missingPartIds = [...new Set(referencedPartIds)]
    .filter((partId) => !context.parts.has(partId))
    .sort(compareStableText);
  if (missingPartIds.length > 0) {
    addIssue(evaluation, issue(
      'authoring.plan.support_part_missing',
      `authoringProfile.slots.${slot.slotId}.support`,
      `Support contract for slot "${slot.slotId}" is not fully materialized.`,
      'compile every declared support-region part before delivery',
      missingPartIds
    ), false);
  }
  return {
    referencedPartIds: [...new Set(referencedPartIds)].sort(compareStableText),
    missingPartIds,
    valid:
      unowned.length === 0 &&
      duplicates.length === 0 &&
      missingPartIds.length === 0
  };
};

const validateGroundingIntent = (
  slot: AuthoringSlotAssignment,
  support: Exclude<AuthoringSupport, { kind: 'none' }>,
  context: EvaluationContext,
  evaluation: MutableEvaluation
): void => {
  if (
    support.contact === 'grounded' &&
    context.document.intent?.grounding !== 'grounded'
  ) {
    addIssue(evaluation, issue(
      'authoring.plan.support_grounding_intent_invalid',
      `authoringProfile.slots.${slot.slotId}.support.contact`,
      `Slot "${slot.slotId}" declares grounded support outside grounded project intent.`,
      'grounded project intent, or free support contact'
    ), true);
  }
};

const evaluateBase = (
  slot: AuthoringSlotAssignment,
  support: Extract<AuthoringSupport, { kind: 'base' }>,
  context: EvaluationContext,
  evaluation: MutableEvaluation,
  references: ReturnType<typeof validateSupportReferences>
): SupportQualityStatus => {
  const issueStart = evaluation.issues.length;
  validateGroundingIntent(slot, support, context, evaluation);
  let groundCells = 0;
  if (references.valid && support.contact === 'grounded') {
    for (const partId of support.supportPartIds) {
      const partCells = context.parts.get(partId)?.occupancy.cells ?? new Set();
      const contacts = groundContactCellCount(partCells);
      const penetrations = belowGroundCellCount(partCells);
      groundCells += contacts;
      if (contacts === 0 || penetrations > 0) {
        addIssue(evaluation, issue(
          'authoring.plan.support_ground_contact_invalid',
          `authoringProfile.slots.${slot.slotId}.support.supportPartIds`,
          contacts === 0
            ? `Base support part "${partId}" has no canonical contact at lattice y=0.`
            : `Base support part "${partId}" penetrates below lattice y=0 ` +
              `with ${penetrations} canonical cell${penetrations === 1 ? '' : 's'}.`,
          'every grounded base part owning at least one y=0 cell and no cell below y=0',
          [partId]
        ), true);
      }
    }
  }
  const localIssues = evaluation.issues.slice(issueStart);
  return {
    slotId: slot.slotId,
    supportKind: 'base',
    contact: support.contact,
    state:
      references.missingPartIds.length > 0
        ? 'incomplete'
        : !references.valid || localIssues.length > 0
          ? 'invalid'
          : 'complete',
    referencedPartIds: references.referencedPartIds,
    missingPartIds: references.missingPartIds,
    groundContactCellCount: groundCells,
    downwardExposedSoleCellCount: 0,
    toeForwardMarginCells: null,
    clawForwardMarginCells: null,
    issueCodes: localIssues.map((entry) => entry.code)
  };
};

/** Validates a real radial rolling contact, not a base masquerading as a wheel. */
const evaluateWheel = (
  slot: AuthoringSlotAssignment,
  support: Extract<AuthoringSupport, { kind: 'wheel' }>,
  context: EvaluationContext,
  evaluation: MutableEvaluation,
  references: ReturnType<typeof validateSupportReferences>
): SupportQualityStatus => {
  const issueStart = evaluation.issues.length;
  validateGroundingIntent(slot, support, context, evaluation);
  let groundCells = 0;
  if (references.valid) {
    for (const partId of support.wheelPartIds) {
      const part = context.parts.get(partId);
      const cells = part?.occupancy.cells ?? new Set();
      const contacts = groundContactCellCount(cells);
      const penetrations = belowGroundCellCount(cells);
      groundCells += contacts;
      if (
        part?.primitive !== 'radial' ||
        part.joint.kind !== 'hinge' ||
        part.joint.axis !== context.frame.lateralAxis
      ) {
        addIssue(evaluation, issue(
          'authoring.plan.support_wheel_primitive_invalid',
          `authoringProfile.slots.${slot.slotId}.support.wheelPartIds`,
          `Wheel support part "${partId}" is not a lateral-axis hinged radial primitive.`,
          'one radial primitive with a hinge around the project lateral axis',
          [partId]
        ), true);
      }
      if (support.contact === 'grounded' && (contacts === 0 || penetrations > 0)) {
        addIssue(evaluation, issue(
          'authoring.plan.support_ground_contact_invalid',
          `authoringProfile.slots.${slot.slotId}.support.wheelPartIds`,
          contacts === 0
            ? `Rolling wheel "${partId}" has no canonical contact at lattice y=0.`
            : `Rolling wheel "${partId}" penetrates below lattice y=0 ` +
              `with ${penetrations} canonical cell${penetrations === 1 ? '' : 's'}.`,
          'every grounded wheel owning at least one y=0 cell and no cell below y=0',
          [partId]
        ), true);
      }
    }
  }
  const localIssues = evaluation.issues.slice(issueStart);
  return {
    slotId: slot.slotId,
    supportKind: 'wheel',
    contact: support.contact,
    state:
      references.missingPartIds.length > 0
        ? 'incomplete'
        : !references.valid || localIssues.length > 0
          ? 'invalid'
          : 'complete',
    referencedPartIds: references.referencedPartIds,
    missingPartIds: references.missingPartIds,
    groundContactCellCount: groundCells,
    downwardExposedSoleCellCount: 0,
    toeForwardMarginCells: null,
    clawForwardMarginCells: null,
    issueCodes: localIssues.map((entry) => entry.code)
  };
};

const validateFootHierarchy = (
  slot: AuthoringSlotAssignment,
  support: Extract<AuthoringSupport, { kind: 'foot' }>,
  context: EvaluationContext,
  evaluation: MutableEvaluation
): void => {
  const distalIds = [
    ...support.solePartIds,
    ...support.digits.flatMap((digit) => [
      ...digit.toePartIds,
      ...digit.clawPartIds
    ])
  ];
  const outsideRoot = distalIds.filter(
    (partId) => !isStrictDescendant(partId, support.rootPartId, context.parts)
  );
  if (outsideRoot.length > 0) {
    addIssue(evaluation, issue(
      'authoring.plan.support_hierarchy_invalid',
      `authoringProfile.slots.${slot.slotId}.support`,
      `Foot regions in slot "${slot.slotId}" are outside the declared foot root hierarchy.`,
      'every sole, toe, and claw part descending from rootPartId',
      outsideRoot
    ), true);
  }
  for (const digit of support.digits) {
    const outsideToe = digit.clawPartIds.filter(
      (clawPartId) => !digit.toePartIds.some(
        (toePartId) => isStrictDescendant(
          clawPartId,
          toePartId,
          context.parts
        )
      )
    );
    if (outsideToe.length === 0) continue;
    addIssue(evaluation, issue(
      'authoring.plan.support_hierarchy_invalid',
      `authoringProfile.slots.${slot.slotId}.support.digits.${digit.digitId}`,
      `Claw regions for digit "${digit.digitId}" do not descend from that digit's toe chain.`,
      'each claw descending from at least one toe part in the same digit',
      outsideToe
    ), true);
  }
};

const evaluateDigit = (
  slot: AuthoringSlotAssignment,
  digit: AuthoringFootDigit,
  soleMetrics: RegionMetrics,
  context: EvaluationContext,
  evaluation: MutableEvaluation
): { toeMargin: number | null; clawMargin: number | null } => {
  const toeCells = cellsForParts(digit.toePartIds, context.parts);
  const clawCells = cellsForParts(digit.clawPartIds, context.parts);
  const toeMetrics = regionMetrics(toeCells, context.forward);
  const clawMetrics = regionMetrics(clawCells, context.forward);
  let toeMargin: number | null = null;
  let clawMargin: number | null = null;
  if (toeMetrics) {
    const centroidMargin =
      dot(toeMetrics.centroid, context.forward) -
      dot(soleMetrics.centroid, context.forward);
    const extentMargin =
      toeMetrics.maximumForward - soleMetrics.maximumForward;
    toeMargin = Math.min(centroidMargin, extentMargin);
    const toeEnvironment = environmentWithout(context.allCells, clawCells);
    if (
      centroidMargin <= EPSILON ||
      extentMargin <= EPSILON ||
      exposedCellCount(toeCells, context.forward, toeEnvironment) === 0
    ) {
      addIssue(evaluation, issue(
        'authoring.plan.support_toe_direction_invalid',
        `authoringProfile.slots.${slot.slotId}.support.digits.${digit.digitId}.toePartIds`,
        `Toe region "${digit.digitId}" does not extend toward the declared project front.`,
        'toe centroid and distal extent ahead of the sole with a forward boundary',
        digit.toePartIds
      ), true);
    }
  }
  if (clawMetrics && toeMetrics) {
    const centroidMargin =
      dot(clawMetrics.centroid, context.forward) -
      dot(toeMetrics.centroid, context.forward);
    const extentMargin =
      clawMetrics.maximumForward - toeMetrics.maximumForward;
    clawMargin = Math.min(centroidMargin, extentMargin);
    if (
      centroidMargin <= EPSILON ||
      extentMargin <= EPSILON ||
      exposedCellCount(clawCells, context.forward, context.allCells) === 0
    ) {
      addIssue(evaluation, issue(
        'authoring.plan.support_claw_direction_invalid',
        `authoringProfile.slots.${slot.slotId}.support.digits.${digit.digitId}.clawPartIds`,
        `Claw region "${digit.digitId}" does not extend toward the declared project front.`,
        'claw centroid and distal extent ahead of its toe with a forward-exposed tip',
        digit.clawPartIds
      ), true);
    }
  }
  return { toeMargin, clawMargin };
};

const evaluateFoot = (
  slot: AuthoringSlotAssignment,
  support: Extract<AuthoringSupport, { kind: 'foot' }>,
  context: EvaluationContext,
  evaluation: MutableEvaluation,
  references: ReturnType<typeof validateSupportReferences>
): SupportQualityStatus => {
  const issueStart = evaluation.issues.length;
  validateGroundingIntent(slot, support, context, evaluation);
  let groundCells = 0;
  let exposedSoleCells = 0;
  const toeMargins: number[] = [];
  const clawMargins: number[] = [];
  if (references.valid) {
    validateFootHierarchy(slot, support, context, evaluation);
    const rootCells = cellsForParts([support.rootPartId], context.parts);
    const soleCells = cellsForParts(support.solePartIds, context.parts);
    const rootMetrics = regionMetrics(rootCells, context.forward);
    const soleMetrics = regionMetrics(soleCells, context.forward);
    const downward = { x: 0, y: -1, z: 0 } as const;
    const solePartsWithoutDownwardExposure = support.solePartIds.filter(
      (partId) => exposedCellCount(
        context.parts.get(partId)?.occupancy.cells ?? new Set(),
        downward,
        context.allCells
      ) === 0
    );
    exposedSoleCells = exposedCellCount(
      soleCells,
      downward,
      context.allCells
    );
    if (
      !rootMetrics ||
      !soleMetrics ||
      soleMetrics.centroid[1] >= rootMetrics.centroid[1] - EPSILON ||
      solePartsWithoutDownwardExposure.length > 0
    ) {
      addIssue(evaluation, issue(
        'authoring.plan.support_sole_orientation_invalid',
        `authoringProfile.slots.${slot.slotId}.support.solePartIds`,
        `Foot sole in slot "${slot.slotId}" is not a downward-facing region below its root.`,
        'sole occupancy below rootPartId with at least one downward-exposed cell',
        solePartsWithoutDownwardExposure.length > 0
          ? solePartsWithoutDownwardExposure
          : support.solePartIds
      ), true);
    }
    if (support.contact === 'grounded') {
      for (const partId of support.solePartIds) {
        const partCells = context.parts.get(partId)?.occupancy.cells ?? new Set();
        const contacts = groundContactCellCount(partCells);
        const penetrations = belowGroundCellCount(partCells);
        groundCells += contacts;
        if (contacts === 0 || penetrations > 0) {
          addIssue(evaluation, issue(
            'authoring.plan.support_ground_contact_invalid',
            `authoringProfile.slots.${slot.slotId}.support.solePartIds`,
            contacts === 0
              ? `Grounded sole part "${partId}" has no canonical contact at lattice y=0.`
              : `Grounded sole part "${partId}" penetrates below lattice y=0 ` +
                `with ${penetrations} canonical cell${penetrations === 1 ? '' : 's'}.`,
            'every grounded sole part owning at least one y=0 cell and no cell below y=0',
            [partId]
          ), true);
        }
      }
    }
    if (soleMetrics) {
      for (const digit of support.digits) {
        const metrics = evaluateDigit(
          slot,
          digit,
          soleMetrics,
          context,
          evaluation
        );
        if (metrics.toeMargin !== null) toeMargins.push(metrics.toeMargin);
        if (metrics.clawMargin !== null) clawMargins.push(metrics.clawMargin);
      }
    }
  }
  const localIssues = evaluation.issues.slice(issueStart);
  return {
    slotId: slot.slotId,
    supportKind: 'foot',
    contact: support.contact,
    state:
      references.missingPartIds.length > 0
        ? 'incomplete'
        : !references.valid || localIssues.length > 0
          ? 'invalid'
          : 'complete',
    referencedPartIds: references.referencedPartIds,
    missingPartIds: references.missingPartIds,
    groundContactCellCount: groundCells,
    downwardExposedSoleCellCount: exposedSoleCells,
    toeForwardMarginCells: minimumMargin(toeMargins),
    clawForwardMarginCells: minimumMargin(clawMargins),
    issueCodes: localIssues.map((entry) => entry.code)
  };
};

const evaluateSlot = (
  slot: AuthoringSlotAssignment,
  context: EvaluationContext,
  evaluation: MutableEvaluation
): SupportQualityStatus => {
  if (slot.support.kind === 'none') return statusForNone(slot);
  const issueStart = evaluation.issues.length;
  const violationStart = evaluation.violations.length;
  const references = validateSupportReferences(slot, context, evaluation);
  const status = slot.support.kind === 'base'
    ? evaluateBase(slot, slot.support, context, evaluation, references)
    : slot.support.kind === 'wheel'
      ? evaluateWheel(slot, slot.support, context, evaluation, references)
      : evaluateFoot(slot, slot.support, context, evaluation, references);
  const hasViolation = evaluation.violations.length > violationStart;
  return {
    ...status,
    state: hasViolation ? 'invalid' : status.state,
    issueCodes: evaluation.issues
      .slice(issueStart)
      .map((entry) => entry.code)
  };
};

const unavailableEvaluation = (
  profile: AuthoringProfile,
  entry: SupportQualityIssue
): SupportQualityEvaluation => ({
  statuses: profile.slots.map((slot) => slot.support.kind === 'none'
    ? statusForNone(slot)
    : {
        slotId: slot.slotId,
        supportKind: slot.support.kind,
        contact: slot.support.contact,
        state: 'invalid',
        referencedPartIds: supportPartIds(slot.support),
        missingPartIds: [],
        groundContactCellCount: 0,
        downwardExposedSoleCellCount: 0,
        toeForwardMarginCells: null,
        clawForwardMarginCells: null,
        issueCodes: [entry.code]
      }),
  issues: [entry],
  violations: [entry],
  ready: false
});

export const evaluateSupportQuality = (
  document: ProjectDocument,
  profile: AuthoringProfile
): SupportQualityEvaluation => {
  if (!document.intent) {
    return unavailableEvaluation(profile, issue(
      'authoring.plan.support_evaluation_unavailable',
      'intent',
      'Support quality cannot be evaluated without project intent.',
      'project intent with explicit forward and grounding authority'
    ));
  }
  const compiled = readCompiledParts(document);
  if (!compiled.ok) {
    return unavailableEvaluation(profile, issue(
      'authoring.plan.support_evaluation_unavailable',
      compiled.issues[0]?.path ?? 'scene.parts',
      compiled.issues[0]?.message ??
        'Support quality cannot be evaluated because compiled geometry is invalid.',
      'valid compiler-owned canonical occupancy'
    ));
  }
  const frame = projectSpatialFrame(document.intent);
  const context: EvaluationContext = {
    document,
    parts: compiled.parts,
    allCells: new Set(
      [...compiled.parts.values()].flatMap((part) => [
        ...part.occupancy.cells
      ])
    ),
    frame,
    forward: {
      x: frame.forward[0],
      y: frame.forward[1],
      z: frame.forward[2]
    }
  };
  const evaluation: MutableEvaluation = { issues: [], violations: [] };
  const slotStatuses = profile.slots.map((slot) =>
    evaluateSlot(slot, context, evaluation)
  );
  const pairCodes = validateSupportPairReflections(
    profile,
    context,
    evaluation
  );
  const statuses = slotStatuses.map((status): SupportQualityStatus => {
    const codes = pairCodes.get(status.slotId) ?? [];
    return codes.length === 0
      ? status
      : {
          ...status,
          state: 'invalid',
          issueCodes: [...status.issueCodes, ...codes]
        };
  });
  const hasGroundedSupport = profile.slots.some(
    (slot) =>
      slot.support.kind !== 'none' &&
      slot.support.contact === 'grounded'
  );
  if (document.intent.grounding === 'grounded' && !hasGroundedSupport) {
    addIssue(evaluation, issue(
      'authoring.plan.support_grounding_missing',
      'authoringProfile.slots',
      'Grounded project intent has no declared grounded support authority.',
      'at least one base, foot, or wheel slot with grounded contact'
    ), true);
  }
  return {
    statuses,
    issues: evaluation.issues,
    violations: evaluation.violations,
    ready:
      evaluation.issues.length === 0 &&
      statuses.every(
        (status) =>
          status.state === 'complete' ||
          status.state === 'not-applicable'
      )
  };
};
