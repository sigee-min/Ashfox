import type { AuthoringSlotAssignment } from '../../contract';
import {
  addSpanQualityIssue as addIssue,
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

export const evaluateSpanSpars = (
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
  const direction = spanExtensionDirection(slot, span, context);
  const rootRange = direction
    ? spanDirectionalRange(rootCells, direction)
    : null;
  for (const spar of span.spars) {
    const sparIds = new Set(spar.partIds);
    const sparCells = spanCellsForParts(spar.partIds, context.parts);
    const hierarchyInvalid = spar.partIds.filter((partId) =>
      !reachesSpanSupport(partId, rootIds, sparIds, context)
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
  return evaluation;
};
