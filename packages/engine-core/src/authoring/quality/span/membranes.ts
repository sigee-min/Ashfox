import type { CellKey } from '../../../modeling/contract';
import type { AuthoringSlotAssignment } from '../../contract';
import {
  addSpanQualityIssue as addIssue,
  membraneInsideSupportEnvelope,
  membraneProjectedEnvelopeCoverage,
  spanAdjacencyCount,
  spanCellsConnected,
  spanCellsForParts,
  spanDirectionalRange,
  spanQualityIssue as issue
} from './geometry';
import { spanExtensionDirection } from './placement';
import { reachesSpanSupport } from './references';
import type {
  MutableSpanQualityEvaluation,
  SpanEvaluationContext,
  SpanStageFindings,
  SupportedSpan
} from './contract';

export const MIN_SPAN_MEMBRANE_ENVELOPE_COVERAGE = 0.3;

const mergedCells = (
  groups: readonly ReadonlySet<CellKey>[]
): ReadonlySet<CellKey> => new Set(groups.flatMap((cells) => [...cells]));

export const evaluateSpanMembranes = (
  slot: AuthoringSlotAssignment,
  span: SupportedSpan,
  context: SpanEvaluationContext
): SpanStageFindings => {
  const evaluation: MutableSpanQualityEvaluation = {
    issues: [],
    violations: []
  };
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
      !reachesSpanSupport(partId, supportIds, membraneIds, context)
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
    const direction = spanExtensionDirection(slot, span, context);
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
  return evaluation;
};
