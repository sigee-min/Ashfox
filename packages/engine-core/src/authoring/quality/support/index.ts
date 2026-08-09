import type { ProjectDocument } from '../../../model';
import { readCompiledParts } from '../../../modeling/invariants';
import { projectSpatialFrame } from '../../../project/frame';
import { validateSupportPairReflections } from '../../reflection/support';
import type {
  AuthoringProfile,
  AuthoringSlotAssignment
} from '../../contract';
import { evaluateBaseSupport } from './base';
import { evaluateFootSupport } from './foot';
import { supportQualityIssue as issue } from './geometry';
import { evaluateGroundingPresence } from './intent';
import { evaluateSupportReferences } from './references';
import {
  appendSupportIssueCodes,
  isSupportReady,
  noneSupportEvaluation,
  unavailableSupportEvaluation,
  type SupportSlotEvaluation
} from './status';
import { evaluateWheelSupport } from './wheel';
import type {
  MutableSupportEvaluation,
  SupportEvaluationContext,
  SupportQualityEvaluation,
  SupportQualityStatus
} from './contract';

export type {
  SupportQualityEvaluation,
  SupportQualityIssue,
  SupportQualityIssueCode,
  SupportQualityState,
  SupportQualityStatus
} from './contract';

const evaluateSlot = (
  slot: AuthoringSlotAssignment,
  context: SupportEvaluationContext
): SupportSlotEvaluation => {
  if (slot.support.kind === 'none') return noneSupportEvaluation(slot);
  const references = evaluateSupportReferences(slot, context);
  if (slot.support.kind === 'base') {
    return evaluateBaseSupport(slot, slot.support, context, references);
  }
  return slot.support.kind === 'wheel'
    ? evaluateWheelSupport(slot, slot.support, context, references)
    : evaluateFootSupport(slot, slot.support, context, references);
};

export const evaluateSupportQuality = (
  document: ProjectDocument,
  profile: AuthoringProfile
): SupportQualityEvaluation => {
  if (!document.intent) {
    return unavailableSupportEvaluation(profile, issue(
      'authoring.plan.support_evaluation_unavailable',
      'intent',
      'Support quality cannot be evaluated without project intent.',
      'project intent with explicit forward and grounding authority'
    ));
  }
  const compiled = readCompiledParts(document);
  if (!compiled.ok) {
    return unavailableSupportEvaluation(profile, issue(
      'authoring.plan.support_evaluation_unavailable',
      compiled.issues[0]?.path ?? 'scene.parts',
      compiled.issues[0]?.message ??
        'Support quality cannot be evaluated because compiled geometry is invalid.',
      'valid compiler-owned canonical occupancy'
    ));
  }
  const frame = projectSpatialFrame(document.intent);
  const context: SupportEvaluationContext = {
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
  const slotEvaluations = profile.slots.map((slot) =>
    evaluateSlot(slot, context)
  );
  const pairEvaluation: MutableSupportEvaluation = {
    issues: [],
    violations: []
  };
  const pairCodes = validateSupportPairReflections(
    profile,
    context,
    pairEvaluation
  );
  const statuses = slotEvaluations.map(
    ({ status }): SupportQualityStatus => appendSupportIssueCodes(
      status,
      pairCodes.get(status.slotId) ?? []
    )
  );
  const grounding = evaluateGroundingPresence(document, profile);
  const issues = [
    ...slotEvaluations.flatMap((evaluation) => evaluation.issues),
    ...pairEvaluation.issues,
    ...grounding.issues
  ];
  const violations = [
    ...slotEvaluations.flatMap((evaluation) => evaluation.violations),
    ...pairEvaluation.violations,
    ...grounding.violations
  ];
  return {
    statuses,
    issues,
    violations,
    ready: isSupportReady(statuses, issues)
  };
};
