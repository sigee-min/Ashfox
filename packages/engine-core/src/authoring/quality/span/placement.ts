import type { AuthoringSlotAssignment } from '../../contract';
import {
  addSpanQualityIssue as addIssue,
  spanCrossPlanePartIds,
  spanGroundedPartIds,
  spanQualityIssue as issue
} from './geometry';
import type {
  MutableSpanQualityEvaluation,
  SpanEvaluationContext,
  SpanStageFindings,
  SupportedSpan
} from './contract';

export const lateralSpanSide = (
  slot: AuthoringSlotAssignment
): 'left' | 'right' | null => {
  const left = slot.spatialRelations.includes('left');
  const right = slot.spatialRelations.includes('right');
  return left === right ? null : left ? 'left' : 'right';
};

export const spanExtensionDirection = (
  slot: AuthoringSlotAssignment,
  span: SupportedSpan,
  context: SpanEvaluationContext
): readonly [number, number, number] | null => {
  const growth = context.document.intent?.semanticContract
    .supportedSurfaces.find((obligation) =>
      obligation.id === span.obligationId
    )?.growth;
  if (growth === 'up') return context.frame.up;
  if (growth === 'forward') return context.frame.forward;
  if (growth === 'rearward') {
    return context.frame.forward.map((coordinate) => -coordinate) as
      [number, number, number];
  }
  if (growth === 'left') return context.frame.left;
  if (growth === 'right') return context.frame.right;
  if (growth !== 'outward') return null;
  const side = lateralSpanSide(slot);
  return side === null ? null : context.frame[side];
};

export const evaluateSpanPlacement = (
  slot: AuthoringSlotAssignment,
  partIds: readonly string[],
  context: SpanEvaluationContext
): SpanStageFindings => {
  const evaluation: MutableSpanQualityEvaluation = {
    issues: [],
    violations: []
  };
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
  const side = lateralSpanSide(slot);
  if (context.frame.planeTwice === null || side === null) return evaluation;
  const crossed = spanCrossPlanePartIds(
    partIds,
    side,
    context.parts,
    context.frame
  );
  if (crossed.length > 0) {
    addIssue(evaluation, issue(
      'authoring.plan.span_cross_plane_invalid',
      `authoringProfile.slots.${slot.slotId}.span`,
      `Span slot "${slot.slotId}" crosses its bilateral half-space.`,
      `every canonical span cell strictly on the declared ${side} side`,
      crossed
    ), true);
  }
  return evaluation;
};
