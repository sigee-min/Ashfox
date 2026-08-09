import type { ProjectDocument } from '../model';
import {
  evaluateProjectIntentRequirements,
  type ProjectIntentRequirementCode
} from '../project/projectIntentEvaluation';
import type {
  ProductionReadinessCode,
  ProductionReadinessFinding
} from './types';

export interface IntentReadiness {
  findings: readonly ProductionReadinessFinding[];
  counts: {
    intentPresent: boolean;
    features: number;
    unverifiableGeometry: number;
    groundSupportCells: number;
    projectedFootprintCells: number;
    uniformCenterOfMassSupported: boolean | null;
  };
}

const productionIntentCode = (
  code: ProjectIntentRequirementCode
): ProductionReadinessCode => {
  switch (code) {
    case 'intent_missing':
      return 'production.intent_missing';
    case 'intent_invalid':
      return 'production.intent_invalid';
    case 'grounding_mismatch':
      return 'production.intent_grounding_mismatch';
    case 'grounding_unstable':
      return 'production.intent_grounding_unstable';
    case 'grounding_unverifiable':
      return 'production.intent_grounding_unverifiable';
    case 'evaluation_unavailable':
      return 'production.intent_evaluation_unavailable';
  }
};

export const evaluateIntentReadiness = (
  document: ProjectDocument
): IntentReadiness => {
  const report = evaluateProjectIntentRequirements(document);
  const pending: readonly ProductionReadinessFinding[] =
    document.intentProgramProposal
      ? [{
          code: 'production.intent_confirmation_pending',
          severity: 'error',
          message:
            'An Intent Program proposal is awaiting user review and compilation.',
          path: 'intentProgramProposal',
          fix:
            'The user must review the pending program and compile its displayed hash before delivery.'
        }]
      : [];
  return {
    findings: [
      ...pending,
      ...report.issues.map((issue) => ({
        code: productionIntentCode(issue.code),
        severity: 'error' as const,
        message: issue.message,
        path: issue.path,
        entityIds: issue.entityIds,
        idsTruncated: issue.idsTruncated,
        fix: issue.fix
      }))
    ],
    counts: {
      intentPresent: report.intentPresent,
      ...report.counts
    }
  };
};
