import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch
} from 'react';

import {
  type CommandBatch,
  type ProjectDocument,
  type ValidationReport
} from '@ashfox/engine-core';

import type {
  CommandOutcome
} from '../workbench/state/commandOutcome';
import type {
  HistoryAction
} from '../workbench/state/historyReducer';
import { useLatestValue } from '../../hooks/useLatestValue';
import {
  AgentCommandPort,
  type AgentCommandPortStatus
} from './AgentCommandPort';
import { inspectProject } from './inspect';
import type {
  PresentRequest,
  PresentResult
} from './types';

interface UseAgentCommandPortInput {
  document: ProjectDocument;
  commandOutcome: CommandOutcome | null;
  selectedNodeId: string | null;
  report: ValidationReport;
  dispatch: Dispatch<HistoryAction>;
  onFocusEntity: (nodeId: string) => void;
  onPresent: (request: PresentRequest) => PresentResult;
}

interface PendingCommand {
  commandId: string;
  timer: number;
  resolve: (outcome: CommandOutcome) => void;
}

const COMMAND_COMMIT_TIMEOUT_MS = 2_000;

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

export const useAgentCommandPort = ({
  document,
  commandOutcome,
  selectedNodeId,
  report,
  dispatch,
  onFocusEntity,
  onPresent
}: UseAgentCommandPortInput): AgentCommandPortStatus => {
  const [status, setStatus] =
    useState<AgentCommandPortStatus>('connected');
  const mountedRef = useRef(true);
  const pendingRef = useRef<PendingCommand | null>(null);
  const documentRef = useLatestValue(document);
  const selectedNodeIdRef = useLatestValue(selectedNodeId);
  const reportRef = useLatestValue(report);
  const onFocusEntityRef = useLatestValue(onFocusEntity);
  const onPresentRef = useLatestValue(onPresent);

  const submit = useCallback(
    (batch: CommandBatch): Promise<CommandOutcome> =>
      new Promise<CommandOutcome>((resolve) => {
        const timer = window.setTimeout(() => {
          if (pendingRef.current?.commandId === batch.batchId) {
            pendingRef.current = null;
          }
          resolve({
            status: 'rejected',
            commandId: batch.batchId,
            revision: documentRef.current.revision,
            error: {
              code: 'invalid_state',
              message: 'Command commit timed out.',
              expected: 'a canonical reducer outcome'
            }
          });
        }, COMMAND_COMMIT_TIMEOUT_MS);
        pendingRef.current = {
          commandId: batch.batchId,
          timer,
          resolve
        };
        dispatch({
          type: 'execute',
          batch,
          actorId: 'ashfox-agent',
          source: 'agent',
          committedAt: new Date().toISOString()
        });
      }),
    [dispatch]
  );

  const port = useMemo<AgentCommandPort>(
    () =>
      new AgentCommandPort({
        inspect: (request) =>
          inspectProject(
            documentRef.current,
            selectedNodeIdRef.current,
            reportRef.current,
            request
          ),
        currentRevision: () => documentRef.current.revision,
        submit,
        present: (request) => onPresentRef.current(request),
        onStatusChange: (nextStatus) => {
          if (mountedRef.current) setStatus(nextStatus);
        }
      }),
    [submit]
  );

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending || commandOutcome?.commandId !== pending.commandId) return;
    pendingRef.current = null;
    window.clearTimeout(pending.timer);

    if (commandOutcome.status === 'committed') {
      const effects = commandOutcome.receipt.effects;
      const focusId =
        effects.createdEntityIds[0] ??
        effects.changedEntityIds[0];
      if (focusId && documentRef.current.scene.nodes[focusId]) {
        onFocusEntityRef.current(focusId);
      }
    }

    void waitForPresentation().then(() => pending.resolve(commandOutcome));
  }, [commandOutcome]);

  useEffect(() => {
    mountedRef.current = true;
    const disconnect = port.connect(window);
    return () => {
      mountedRef.current = false;
      disconnect();
      const pending = pendingRef.current;
      if (!pending) return;
      pendingRef.current = null;
      window.clearTimeout(pending.timer);
      pending.resolve({
        status: 'rejected',
        commandId: pending.commandId,
        revision: documentRef.current.revision,
        error: {
          code: 'invalid_state',
          message: 'Command batch was cancelled.'
        }
      });
    };
  }, [port]);

  return status;
};
