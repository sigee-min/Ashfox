'use client';

import { useCallback, useEffect, useRef, type Dispatch } from 'react';
import type { AssetProject, CommandBatch } from '@ashfox/engine-core';
import type { CommandOutcome } from '../../../application/commandOutcome';
import type { HistoryAction } from '../../../application/historyReducer';
import { useLatestValue } from '../../../hooks/useLatestValue';
import { AGENT_ACTOR_ID } from '../agentIdentity';

interface PendingCommand {
  commandId: string;
  resolve: (outcome: CommandOutcome) => void;
}

interface UseAgentCommandSubmissionInput {
  project: AssetProject;
  commandOutcomes: readonly CommandOutcome[];
  dispatch: Dispatch<HistoryAction>;
  onFocusEntity: (nodeId: string) => void;
}

const waitForPresentation = (): Promise<void> => new Promise<void>((resolve) => {
  let settled = false;
  let frame = 0;
  let timer = 0;
  const finish = (): void => {
    if (settled) return;
    settled = true;
    window.cancelAnimationFrame(frame);
    window.clearTimeout(timer);
    resolve();
  };
  frame = window.requestAnimationFrame(finish);
  timer = window.setTimeout(finish, 250);
});

export const useAgentCommandSubmission = ({
  project,
  commandOutcomes,
  dispatch,
  onFocusEntity
}: UseAgentCommandSubmissionInput) => {
  const pendingRef = useRef<PendingCommand | null>(null);
  const projectRef = useLatestValue(project);
  const onFocusEntityRef = useLatestValue(onFocusEntity);

  const submit = useCallback((batch: CommandBatch): Promise<CommandOutcome> =>
    new Promise<CommandOutcome>((resolve) => {
      pendingRef.current = { commandId: batch.batchId, resolve };
      dispatch({
        type: 'execute', batch, actorId: AGENT_ACTOR_ID, source: 'agent',
        committedAt: new Date().toISOString()
      });
    }), [dispatch]);

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    const outcome = commandOutcomes.find((entry) =>
      entry.commandId === pending.commandId);
    if (!outcome) return;
    pendingRef.current = null;
    if (outcome.status === 'committed') {
      const effects = outcome.receipt.effects;
      const focusId = [...effects.createdEntityIds, ...effects.changedEntityIds]
        .find((id) => projectRef.current.document.scene.nodes[id] !== undefined);
      if (focusId) onFocusEntityRef.current(focusId);
    }
    void waitForPresentation().then(() => pending.resolve(outcome));
  }, [commandOutcomes, projectRef, onFocusEntityRef]);

  const cancelPending = useCallback((): void => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    pending.resolve({
      status: 'rejected', commandId: pending.commandId,
      revision: projectRef.current.revision,
      error: { code: 'invalid_state', message: 'Command batch was cancelled.' }
    });
  }, [projectRef]);

  return { submit, cancelPending };
};
