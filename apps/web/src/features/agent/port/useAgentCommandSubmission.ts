'use client';

import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch
} from 'react';

import type {
  CommandBatch,
  ProjectDocument
} from '@ashfox/engine-core';

import type {
  CommandOutcome
} from '../../../application/commandOutcome';
import type {
  HistoryAction
} from '../../../application/historyReducer';
import {
  useLatestValue
} from '../../../hooks/useLatestValue';

interface PendingCommand {
  commandId: string;
  resolve: (outcome: CommandOutcome) => void;
}

interface UseAgentCommandSubmissionInput {
  document: ProjectDocument;
  commandOutcomes: readonly CommandOutcome[];
  dispatch: Dispatch<HistoryAction>;
  onFocusEntity: (nodeId: string) => void;
}

const waitForPresentation = (): Promise<void> =>
  new Promise<void>((resolve) => {
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
  document,
  commandOutcomes,
  dispatch,
  onFocusEntity
}: UseAgentCommandSubmissionInput) => {
  const pendingRef = useRef<PendingCommand | null>(null);
  const documentRef = useLatestValue(document);
  const onFocusEntityRef = useLatestValue(onFocusEntity);

  const submit = useCallback((
    batch: CommandBatch
  ): Promise<CommandOutcome> =>
    new Promise<CommandOutcome>((resolve) => {
      pendingRef.current = {
        commandId: batch.batchId,
        resolve
      };
      dispatch({
        type: 'execute',
        batch,
        actorId: 'ashfox-agent',
        source: 'agent',
        committedAt: new Date().toISOString()
      });
    }), [dispatch]);

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    const commandOutcome = commandOutcomes.find(
      (outcome) => outcome.commandId === pending.commandId
    );
    if (!commandOutcome) return;
    pendingRef.current = null;

    if (commandOutcome.status === 'committed') {
      const effects = commandOutcome.receipt.effects;
      const focusId = [
        ...effects.createdEntityIds,
        ...effects.changedEntityIds
      ].find(
        (id) => documentRef.current.scene.nodes[id] !== undefined
      );
      if (focusId) onFocusEntityRef.current(focusId);
    }

    void waitForPresentation().then(
      () => pending.resolve(commandOutcome)
    );
  }, [commandOutcomes, documentRef, onFocusEntityRef]);

  const cancelPending = useCallback((): void => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    pending.resolve({
      status: 'rejected',
      commandId: pending.commandId,
      revision: documentRef.current.revision,
      error: {
        code: 'invalid_state',
        message: 'Command batch was cancelled.'
      }
    });
  }, [documentRef]);

  return { submit, cancelPending };
};
