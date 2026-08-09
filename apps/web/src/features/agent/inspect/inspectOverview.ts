import {
  evaluateProductionReadiness,
  type ProjectDocument,
  type ValidationReport
} from '@ashfox/engine-core';

import {
  boundedSuccess
} from '../boundedResult';
import {
  agentCommandProtocol
} from '../agentCommandProtocol';
import {
  deriveInspectWorkflow
} from '../inspectWorkflow';
import type {
  VisualReviewReceipt
} from '../../../application/review';
import type {
  InspectResult
} from '../types';
import {
  DEFAULT_INSPECT_LIMIT
} from './inspectResult';
import {
  snapshotIntentProgramAuthority
} from '../../intentProgram/presentation';

/** The agent sees source authority and readiness, never editable compiler internals. */
export const inspectOverview = (
  document: ProjectDocument,
  _selectedNodeId: string | null,
  report: ValidationReport,
  visualReviews: readonly VisualReviewReceipt[],
  operationOwner: string | null
): InspectResult => {
  const readiness = evaluateProductionReadiness(document, report);
  const workflow = deriveInspectWorkflow(
    document,
    report,
    readiness,
    visualReviews
  );
  const confirmed = document.intentProgram;
  const proposal = document.intentProgramProposal;
  return boundedSuccess(
    document.revision,
    {
      commandPort: {
        status: operationOwner === null ? 'connected' : 'working',
        operation: operationOwner
      },
      protocol: {
        workbench: agentCommandProtocol.workbench,
        manifest: agentCommandProtocol.href,
        commandSchema: {
          kind: 'command',
          name: '<commands entry>'
        }
      },
      intentProgram: {
        confirmed: confirmed
          ? snapshotIntentProgramAuthority(confirmed)
          : null,
        proposal: proposal
          ? snapshotIntentProgramAuthority(proposal)
          : null
      },
      compilation: {
        status: confirmed === null || confirmed === undefined
          ? 'no-confirmed-source'
          : readiness.structurallyValid
            ? 'ready'
            : 'blocked',
        structurallyValid: readiness.structurallyValid,
        mechanicallyReady: readiness.mechanicallyReady,
        semanticReviewRequired: readiness.semanticReviewRequired,
        firstBlockingFinding: readiness.firstBlockingFinding ?? null
      },
      workflow
    },
    DEFAULT_INSPECT_LIMIT
  );
};
