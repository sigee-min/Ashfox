import {
  type ProjectDocument
} from '@ashfox/engine-core';

import type {
  HistoryAction
} from '../../application/historyReducer';
import {
  LOCAL_COMMAND_ACTOR_ID
} from '../../application/localCommandActor';

export interface IntentProgramCompilationState {
  visible: boolean;
  disabled: boolean;
  reason: string | null;
}

export const intentProgramCompilationState = (
  document: ProjectDocument,
  activeOperationOwner: string | null
): IntentProgramCompilationState => {
  if (!document.intentProgramProposal) {
    return { visible: false, disabled: true, reason: null };
  }
  if (activeOperationOwner !== null) {
    return {
      visible: true,
      disabled: true,
      reason: `Wait for ${activeOperationOwner} to finish.`
    };
  }
  return { visible: true, disabled: false, reason: null };
};

export const createIntentProgramCompilationAction = (
  document: ProjectDocument,
  batchId: string,
  committedAt: string
): HistoryAction | null => {
  const proposal = document.intentProgramProposal;
  const state = intentProgramCompilationState(document, null);
  if (!proposal || state.disabled) return null;

  return {
    type: 'execute',
    batch: {
      batchId,
      baseProjectId: document.id,
      baseRevision: document.revision,
      operations: [{
        name: 'intent.program.compile',
        payload: { hash: proposal.hash }
      }]
    },
    actorId: LOCAL_COMMAND_ACTOR_ID,
    source: 'web',
    committedAt
  };
};
