import {
  listAgentCommandDefinitions,
  type ProjectCommandOperation,
  type ProjectDocument
} from '@ashfox/engine-core';

import type { VisualReviewReceipt } from '../../../application/visualReviewReceipt';
import type {
  InspectWorkflowAction,
  InspectWorkflowStage,
  ReadinessFinding
} from './inspectWorkflowTypes';

interface DerivedWorkflowActions {
  exactOperation: ProjectCommandOperation | null;
  nextActions: readonly InspectWorkflowAction[];
}

const registeredAgentCommands = new Set(
  listAgentCommandDefinitions().map((definition) => definition.name)
);

const command = (
  name: ProjectCommandOperation['name']
): readonly InspectWorkflowAction[] =>
  registeredAgentCommands.has(name)
    ? [{ kind: 'command', name }]
    : [];

const startAction = (): readonly InspectWorkflowAction[] =>
  command('project.create');

export const deriveWorkflowActions = (
  document: ProjectDocument,
  stage: InspectWorkflowStage,
  _blocker: ReadinessFinding | null,
  _rejectedReview: VisualReviewReceipt | null
): DerivedWorkflowActions => {
  if (document.intentProgramProposal) {
    return {
      exactOperation: null,
      nextActions: [{
        kind: 'user-confirmation',
        action: 'confirm-intent-program',
        subject: document.intentProgramProposal.source
      }]
    };
  }
  if (stage === 'start') {
    return { exactOperation: null, nextActions: startAction() };
  }
  if (stage === 'review') {
    return {
      exactOperation: null,
      nextActions: [{ kind: 'present', request: { review: 'next' } }]
    };
  }
  if (stage === 'deliver') return { exactOperation: null, nextActions: [] };
  return {
    exactOperation: null,
    nextActions: command('intent.program.propose')
  };
};

export const fallbackWorkflowFix = (
  stage: InspectWorkflowStage,
  actions: readonly InspectWorkflowAction[]
): string => {
  const first = actions[0];
  if (first?.kind === 'user-confirmation') {
    return 'Wait for the user to confirm the intent program and for the workbench to compile it.';
  }
  if (first?.kind === 'command' && first.name === 'intent.program.propose') {
    return 'Revise the complete intent-program source, submit it, then wait for compilation.';
  }
  if (first?.kind === 'command') {
    return `Correct the project setup with ${first.name}, then inspect again.`;
  }
  if (stage === 'review') {
    return 'Observe and explicitly accept or reject the next compiled review frame.';
  }
  if (stage === 'deliver') {
    return 'Tell the user to choose an export adapter in the Export menu. Target delivery settings are user-owned and never change the canonical asset.';
  }
  return 'Inspect the blocker and revise the intent-program source if compiled output is incomplete.';
};
