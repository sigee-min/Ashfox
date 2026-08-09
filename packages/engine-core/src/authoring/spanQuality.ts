import type { ProjectDocument } from '../model';
import { readCompiledParts } from '../modeling/partInvariants';
import type { CellKey } from '../modeling/types';
import { projectSpatialFrame } from '../project/projectSpatialFrame';
import { compareStableText } from '../stableOrder';
import { validateSpanPairReflections } from './spanPairReflection';
import type { AuthoringSpan } from './authoringSpanTypes';
import type {
  AuthoringProfile,
  AuthoringSlotAssignment
} from './authoringTypes';
import {
  addSpanQualityIssue as addIssue,
  membraneInsideSupportEnvelope,
  membraneProjectedEnvelopeCoverage,
  spanAdjacencyCount,
  spanCellsConnected,
  spanCellsForParts,
  spanCrossPlanePartIds,
  spanDirectionalRange,
  spanGroundedPartIds,
  spanQualityIssue as issue
} from './spanQualityGeometry';
import type {
  MutableSpanQualityEvaluation as MutableEvaluation,
  SpanEvaluationContext as EvaluationContext,
  SpanQualityEvaluation,
  SpanQualityStatus
} from './spanQualityTypes';

export type {
  SpanQualityEvaluation,
  SpanQualityIssue,
  SpanQualityIssueCode,
  SpanQualityState,
  SpanQualityStatus
} from './spanQualityTypes';

type SupportedSpan = Extract<AuthoringSpan, { kind: 'supported-surface' }>;
export const MIN_SPAN_MEMBRANE_ENVELOPE_COVERAGE = 0.3;

const spanForSlot = (slot: AuthoringSlotAssignment): AuthoringSpan =>
  slot.span;

const referencedPartIds = (span: SupportedSpan): readonly string[] => [
  ...span.rootPartIds,
  ...span.spars.flatMap((spar) => spar.partIds),
  ...span.membranes.flatMap((membrane) => membrane.partIds)
].sort(compareStableText);

const statusForNone = (
  slot: AuthoringSlotAssignment
): SpanQualityStatus => ({
  slotId: slot.slotId,
  spanKind: 'none',
  state: 'not-applicable',
  referencedPartIds: [],
  missingPartIds: [],
  issueCodes: []
});

const reachesSupport = (
  partId: string,
  supportPartIds: ReadonlySet<string>,
  sameRegionPartIds: ReadonlySet<string>,
  context: EvaluationContext
): boolean => {
  const visited = new Set<string>();
  let parentPartId = context.parts.get(partId)?.parentPartId ?? null;
  while (parentPartId !== null && !visited.has(parentPartId)) {
    if (supportPartIds.has(parentPartId)) return true;
    if (!sameRegionPartIds.has(parentPartId)) return false;
    visited.add(parentPartId);
    parentPartId = context.parts.get(parentPartId)?.parentPartId ?? null;
  }
  return false;
};

const validateKinds = (
  slot: AuthoringSlotAssignment,
  span: SupportedSpan,
  context: EvaluationContext,
  evaluation: MutableEvaluation
): void => {
  const segmentIds = [
    ...span.rootPartIds,
    ...span.spars.flatMap((spar) => spar.partIds)
  ];
  const plateIds = span.membranes.flatMap((membrane) => membrane.partIds);
  const invalid = [
    ...segmentIds.filter((partId) =>
      context.parts.get(partId)?.primitive !== 'segment'
    ),
    ...plateIds.filter((partId) =>
      context.parts.get(partId)?.primitive !== 'plate'
    )
  ];
  if (invalid.length === 0) return;
  addIssue(evaluation, issue(
    'authoring.plan.span_part_kind_invalid',
    `authoringProfile.slots.${slot.slotId}.span`,
    `Span slot "${slot.slotId}" assigns primitives to the wrong semantic regions.`,
    'root and spar parts compiled as segment; membrane parts compiled as plate',
    invalid
  ), true);
};

const validateRoots = (
  slot: AuthoringSlotAssignment,
  span: SupportedSpan,
  profile: AuthoringProfile,
  context: EvaluationContext,
  evaluation: MutableEvaluation
): void => {
  const parentPartIds = new Set(profile.slots
    .filter((candidate) => slot.parentSlotIds.includes(candidate.slotId))
    .flatMap((candidate) => candidate.partIds));
  const invalid = span.rootPartIds.filter((partId) => {
    const parentPartId = context.parts.get(partId)?.parentPartId ?? null;
    return parentPartId === null || !parentPartIds.has(parentPartId);
  });
  if (invalid.length === 0) return;
  addIssue(evaluation, issue(
    'authoring.plan.span_root_parent_invalid',
    `authoringProfile.slots.${slot.slotId}.span.rootPartIds`,
    `Span roots in slot "${slot.slotId}" do not attach directly to its declared parent slots.`,
    'every root segment directly parented to a part owned by parentSlotIds',
    invalid
  ), true);
};

const mergedCells = (
  groups: readonly ReadonlySet<CellKey>[]
): ReadonlySet<CellKey> => new Set(groups.flatMap((cells) => [...cells]));

const requiredExtensionDirection = (
  slot: AuthoringSlotAssignment,
  span: SupportedSpan,
  context: EvaluationContext
): readonly [number, number, number] | null => {
  const extension = context.document.intent?.semanticContract
    .supportedSurfaces.find((obligation) =>
      obligation.id === span.obligationId
    )?.extension;
  if (extension === 'up') return context.frame.up;
  if (extension === 'forward') return context.frame.forward;
  if (extension === 'rearward') {
    return context.frame.forward.map((coordinate) => -coordinate) as
      [number, number, number];
  }
  if (extension === 'left') return context.frame.left;
  if (extension === 'right') return context.frame.right;
  if (extension !== 'lateral') return null;
  const side = lateralSide(slot);
  return side === null ? null : context.frame[side];
};

const lateralSide = (
  slot: AuthoringSlotAssignment
): 'left' | 'right' | null => {
  const left = slot.spatialRelations.includes('left');
  const right = slot.spatialRelations.includes('right');
  return left === right ? null : left ? 'left' : 'right';
};

const validateSpars = (
  slot: AuthoringSlotAssignment,
  span: SupportedSpan,
  context: EvaluationContext,
  evaluation: MutableEvaluation
): void => {
  const rootIds = new Set(span.rootPartIds);
  const rootCells = spanCellsForParts(span.rootPartIds, context.parts);
  const direction = requiredExtensionDirection(slot, span, context);
  const rootRange = direction
    ? spanDirectionalRange(rootCells, direction)
    : null;
  for (const spar of span.spars) {
    const sparIds = new Set(spar.partIds);
    const sparCells = spanCellsForParts(spar.partIds, context.parts);
    const hierarchyInvalid = spar.partIds.filter((partId) =>
      !reachesSupport(partId, rootIds, sparIds, context)
    );
    if (hierarchyInvalid.length > 0) {
      addIssue(evaluation, issue(
        'authoring.plan.span_hierarchy_invalid',
        `authoringProfile.slots.${slot.slotId}.span.spars.${spar.sparId}`,
        `Spar "${spar.sparId}" does not descend only from the declared span roots.`,
        'each spar part reaching a root through only parts in the same spar region',
        hierarchyInvalid
      ), true);
    }
    if (
      !spanCellsConnected(sparCells) ||
      spanAdjacencyCount(rootCells, sparCells) === 0
    ) {
      addIssue(evaluation, issue(
        'authoring.plan.span_spar_attachment_invalid',
        `authoringProfile.slots.${slot.slotId}.span.spars.${spar.sparId}`,
        `Spar "${spar.sparId}" is not one connected canonical region attached to the root.`,
        'connected spar occupancy with nonzero root face adjacency',
        spar.partIds
      ), true);
    }
    const sparRange = direction
      ? spanDirectionalRange(sparCells, direction)
      : null;
    if (
      !rootRange ||
      !sparRange ||
      sparRange.centroid <= rootRange.centroid ||
      sparRange.maximum <= rootRange.maximum
    ) {
      addIssue(evaluation, issue(
        'authoring.plan.span_spar_extension_invalid',
        `authoringProfile.slots.${slot.slotId}.span.spars.${spar.sparId}`,
        `Spar "${spar.sparId}" does not extend distally along its sealed semantic extension.`,
        'spar centroid and distal extent both farther along the obligation extension vector than the root region',
        spar.partIds
      ), true);
    }
  }
};

const validateMembranes = (
  slot: AuthoringSlotAssignment,
  span: SupportedSpan,
  context: EvaluationContext,
  evaluation: MutableEvaluation
): void => {
  const rootIds = new Set(span.rootPartIds);
  const rootCells = spanCellsForParts(span.rootPartIds, context.parts);
  const sparsById = new Map(span.spars.map((spar) => [spar.sparId, spar]));
  for (const membrane of span.membranes) {
    const boundaries = membrane.boundedBySparIds.flatMap((sparId) => {
      const spar = sparsById.get(sparId);
      return spar ? [spar] : [];
    });
    const supportIds = new Set([
      ...rootIds,
      ...boundaries.flatMap((spar) => spar.partIds)
    ]);
    const membraneIds = new Set(membrane.partIds);
    const hierarchyInvalid = membrane.partIds.filter((partId) =>
      !reachesSupport(partId, supportIds, membraneIds, context)
    );
    if (hierarchyInvalid.length > 0) {
      addIssue(evaluation, issue(
        'authoring.plan.span_hierarchy_invalid',
        `authoringProfile.slots.${slot.slotId}.span.membranes.${membrane.membraneId}`,
        `Membrane "${membrane.membraneId}" is outside its declared support lineage.`,
        'membrane parts parented through the same membrane, its two boundary spars, or the root region',
        hierarchyInvalid
      ), true);
    }
    const membraneCells = spanCellsForParts(membrane.partIds, context.parts);
    const boundaryCells = boundaries.map((spar) =>
      spanCellsForParts(spar.partIds, context.parts)
    );
    const missingBoundary = boundaryCells.some((cells) =>
      spanAdjacencyCount(membraneCells, cells) === 0
    );
    if (
      boundaries.length !== 2 ||
      missingBoundary ||
      !spanCellsConnected(membraneCells)
    ) {
      addIssue(evaluation, issue(
        'authoring.plan.span_membrane_boundary_invalid',
        `authoringProfile.slots.${slot.slotId}.span.membranes.${membrane.membraneId}`,
        `Membrane "${membrane.membraneId}" is floating or does not contact both declared spars.`,
        'one connected membrane with nonzero face adjacency to each boundedBySparIds region',
        membrane.partIds
      ), true);
    }
    const supportCells = mergedCells([rootCells, ...boundaryCells]);
    const direction = requiredExtensionDirection(slot, span, context);
    const rootRange = direction
      ? spanDirectionalRange(rootCells, direction)
      : null;
    const membraneRange = direction
      ? spanDirectionalRange(membraneCells, direction)
      : null;
    const boundaryRanges = direction
      ? boundaryCells.map((cells) => spanDirectionalRange(cells, direction))
      : [];
    const distalBoundary = boundaryRanges.length === 2 &&
      boundaryRanges.every((range) => range !== null)
      ? Math.min(...boundaryRanges.map((range) => range?.maximum ?? Infinity))
      : null;
    const reachesDistalSupport =
      rootRange !== null &&
      membraneRange !== null &&
      distalBoundary !== null &&
      membraneRange.maximum >= distalBoundary - 1;
    const envelopeCoverage = membraneProjectedEnvelopeCoverage(
      membraneCells,
      supportCells
    );
    if (
      !membraneInsideSupportEnvelope(membraneCells, supportCells) ||
      !reachesDistalSupport ||
      envelopeCoverage < MIN_SPAN_MEMBRANE_ENVELOPE_COVERAGE
    ) {
      addIssue(evaluation, issue(
        'authoring.plan.span_membrane_envelope_invalid',
        `authoringProfile.slots.${slot.slotId}.span.membranes.${membrane.membraneId}`,
        `Membrane "${membrane.membraneId}" leaves the canonical root/spar support envelope.`,
        `membrane inside its support envelope, reaching both spars distally, and filling at least ${MIN_SPAN_MEMBRANE_ENVELOPE_COVERAGE * 100}% of the projected envelope`,
        membrane.partIds
      ), true);
    }
  }
};

const validateGlobalPlacement = (
  slot: AuthoringSlotAssignment,
  partIds: readonly string[],
  context: EvaluationContext,
  evaluation: MutableEvaluation
): void => {
  const grounded = spanGroundedPartIds(partIds, context.parts);
  if (grounded.length > 0) {
    addIssue(evaluation, issue(
      'authoring.plan.span_ground_contact_invalid',
      `authoringProfile.slots.${slot.slotId}.span`,
      `Span slot "${slot.slotId}" contacts or penetrates the canonical ground plane.`,
      'all span occupancy strictly above lattice y=0',
      grounded
    ), true);
  }
  const side = lateralSide(slot);
  if (context.frame.planeTwice === null || side === null) return;
  const crossed = spanCrossPlanePartIds(
    partIds,
    side,
    context.parts,
    context.frame
  );
  if (crossed.length === 0) return;
  addIssue(evaluation, issue(
    'authoring.plan.span_cross_plane_invalid',
    `authoringProfile.slots.${slot.slotId}.span`,
    `Span slot "${slot.slotId}" crosses its bilateral half-space.`,
    `every canonical span cell strictly on the declared ${side} side`,
    crossed
  ), true);
};

const evaluateSupportedSpan = (
  slot: AuthoringSlotAssignment,
  span: SupportedSpan,
  profile: AuthoringProfile,
  context: EvaluationContext,
  evaluation: MutableEvaluation
): SpanQualityStatus => {
  const issueStart = evaluation.issues.length;
  const referenced = referencedPartIds(span);
  const missing = referenced.filter((partId) => !context.parts.has(partId));
  if (missing.length > 0) {
    addIssue(evaluation, issue(
      'authoring.plan.span_part_missing',
      `authoringProfile.slots.${slot.slotId}.span`,
      `Span slot "${slot.slotId}" is not fully materialized.`,
      'compile every declared root, spar, and membrane part before delivery',
      missing
    ), false);
  } else {
    validateKinds(slot, span, context, evaluation);
    validateRoots(slot, span, profile, context, evaluation);
    validateSpars(slot, span, context, evaluation);
    validateMembranes(slot, span, context, evaluation);
    validateGlobalPlacement(slot, referenced, context, evaluation);
  }
  const localIssues = evaluation.issues.slice(issueStart);
  return {
    slotId: slot.slotId,
    spanKind: 'supported-surface',
    state: missing.length > 0
      ? 'incomplete'
      : localIssues.length > 0
        ? 'invalid'
        : 'complete',
    referencedPartIds: referenced,
    missingPartIds: missing,
    issueCodes: localIssues.map((entry) => entry.code)
  };
};

export const evaluateSpanQuality = (
  document: ProjectDocument,
  profile: AuthoringProfile
): SpanQualityEvaluation => {
  const slots = profile.slots.filter((slot) =>
    slot.structuralRole === 'span' || spanForSlot(slot).kind !== 'none'
  );
  const noneStatuses = profile.slots
    .filter((slot) => !slots.includes(slot))
    .map(statusForNone);
  if (slots.length === 0) {
    return { statuses: noneStatuses, issues: [], violations: [], ready: true };
  }
  const compiled = readCompiledParts(document);
  if (!compiled.ok || !document.intent) {
    const entry = issue(
      'authoring.plan.span_evaluation_unavailable',
      'authoringProfile.slots',
      'Canonical span occupancy is unavailable for evaluation.',
      'valid compiled part occupancy and normalized project intent'
    );
    return {
      statuses: slots.map((slot) => ({
        slotId: slot.slotId,
        spanKind: spanForSlot(slot).kind,
        state: 'invalid',
        referencedPartIds: slot.partIds,
        missingPartIds: [],
        issueCodes: [entry.code]
      })),
      issues: [entry],
      violations: [entry],
      ready: false
    };
  }
  const context: EvaluationContext = {
    document,
    parts: compiled.parts,
    frame: projectSpatialFrame(document.intent)
  };
  const evaluation: MutableEvaluation = { issues: [], violations: [] };
  const statuses = slots.map((slot) => {
    const span = spanForSlot(slot);
    return span.kind === 'supported-surface'
      ? evaluateSupportedSpan(slot, span, profile, context, evaluation)
      : statusForNone(slot);
  });
  const pairCodes = validateSpanPairReflections(
    profile,
    context,
    evaluation
  );
  const completedStatuses = [...noneStatuses, ...statuses].map((status) => ({
    ...status,
    issueCodes: [
      ...status.issueCodes,
      ...(pairCodes.get(status.slotId) ?? [])
    ],
    state: (pairCodes.get(status.slotId)?.length ?? 0) > 0
      ? 'invalid' as const
      : status.state
  })).sort((left, right) => left.slotId.localeCompare(right.slotId));
  const issues = [...evaluation.issues].sort((left, right) =>
    left.path.localeCompare(right.path) || left.code.localeCompare(right.code)
  );
  const violations = [...evaluation.violations].sort((left, right) =>
    left.path.localeCompare(right.path) || left.code.localeCompare(right.code)
  );
  return {
    statuses: completedStatuses,
    issues,
    violations,
    ready:
      completedStatuses.every((status) =>
        status.state === 'complete' || status.state === 'not-applicable'
      ) && issues.length === 0
  };
};
