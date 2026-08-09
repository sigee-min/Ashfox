import type { ProjectDocument } from '../../../model';
import type {
  AuthoringProfile,
  AuthoringSlotAssignment,
  AuthoringSupport
} from '../../contract';
import { supportQualityIssue as issue } from './geometry';
import type { SupportStageFindings } from './status';
import type { SupportEvaluationContext } from './contract';

const noFindings = (): SupportStageFindings => ({
  issues: [],
  violations: []
});

export const evaluateSupportIntent = (
  slot: AuthoringSlotAssignment,
  support: Exclude<AuthoringSupport, { kind: 'none' }>,
  context: SupportEvaluationContext
): SupportStageFindings => {
  if (
    support.contact !== 'grounded' ||
    context.document.intent?.grounding === 'grounded'
  ) {
    return noFindings();
  }
  const entry = issue(
    'authoring.plan.support_grounding_intent_invalid',
    `authoringProfile.slots.${slot.slotId}.support.contact`,
    `Slot "${slot.slotId}" declares grounded support outside grounded project intent.`,
    'grounded project intent, or free support contact'
  );
  return { issues: [entry], violations: [entry] };
};

export const evaluateGroundingPresence = (
  document: ProjectDocument,
  profile: AuthoringProfile
): SupportStageFindings => {
  const hasGroundedSupport = profile.slots.some(
    (slot) =>
      slot.support.kind !== 'none' &&
      slot.support.contact === 'grounded'
  );
  if (document.intent?.grounding !== 'grounded' || hasGroundedSupport) {
    return noFindings();
  }
  const entry = issue(
    'authoring.plan.support_grounding_missing',
    'authoringProfile.slots',
    'Grounded project intent has no declared grounded support authority.',
    'at least one base, foot, or wheel slot with grounded contact'
  );
  return { issues: [entry], violations: [entry] };
};
