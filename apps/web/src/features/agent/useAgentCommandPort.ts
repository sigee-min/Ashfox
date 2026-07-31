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
  type CommandReceipt,
  type ProjectDocument,
  type ValidationReport
} from '@ashfox/engine-core';

import type {
  CommandOutcome
} from '../../application/commandOutcome';
import type {
  HistoryAction
} from '../../application/historyReducer';
import type {
  ProjectAssets
} from '../../application/projectAssets';
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
  assets: ProjectAssets;
  activity: readonly CommandReceipt[];
  commandOutcomes: readonly CommandOutcome[];
  selectedNodeId: string | null;
  report: ValidationReport;
  dispatch: Dispatch<HistoryAction>;
  onFocusEntity: (nodeId: string) => void;
  onPresent: (request: PresentRequest) => Promise<PresentResult>;
}

interface PendingCommand {
  commandId: string;
  resolve: (outcome: CommandOutcome) => void;
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

export const useAgentCommandPort = ({
  document,
  assets,
  activity,
  commandOutcomes,
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
  const activityRef = useLatestValue(activity);
  const assetsRef = useLatestValue(assets);
  const selectedNodeIdRef = useLatestValue(selectedNodeId);
  const reportRef = useLatestValue(report);
  const onFocusEntityRef = useLatestValue(onFocusEntity);
  const onPresentRef = useLatestValue(onPresent);

  const submit = useCallback(
    (batch: CommandBatch): Promise<CommandOutcome> =>
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
            request,
            activityRef.current,
            assetsRef.current
          ),
        currentProjectId: () => documentRef.current.id,
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
      ].find((id) => documentRef.current.scene.nodes[id] !== undefined);
      if (focusId) {
        onFocusEntityRef.current(focusId);
      }
    }

    void waitForPresentation().then(() => pending.resolve(commandOutcome));
  }, [commandOutcomes]);

  useEffect(() => {
    mountedRef.current = true;
    const disconnect = port.connect(window);
    return () => {
      mountedRef.current = false;
      disconnect();
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
    };
  }, [port]);

  return status;
};
