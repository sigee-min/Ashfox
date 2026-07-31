import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch
} from 'react';

import {
  evaluateProductionReadiness,
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
  OperationLease,
  OperationLeaseToken
} from '../../application/operationLease';
import type {
  ProjectAssets
} from '../../application/projectAssets';
import type {
  ArtifactFile
} from '../files/artifactFile';
import type {
  FileOperationRunResult
} from '../files/useFileOperation';
import { useLatestValue } from '../../hooks/useLatestValue';
import {
  AgentCommandPort,
  type AgentCommandPortStatus
} from './AgentCommandPort';
import { inspectProject } from './inspect';
import type {
  VisualReviewReceipt
} from './presentationReview';
import type {
  PresentRequest,
  PresentResult,
  ViewPresentationRequest
} from './types';
import {
  nextVisualReview
} from './visualReviewPlan';
import {
  deliverAgentProject
} from './deliverAgentProject';

interface UseAgentCommandPortInput {
  document: ProjectDocument;
  projectGeneration: number;
  assets: ProjectAssets;
  activity: readonly CommandReceipt[];
  commandOutcomes: readonly CommandOutcome[];
  selectedNodeId: string | null;
  report: ValidationReport;
  dispatch: Dispatch<HistoryAction>;
  onFocusEntity: (nodeId: string) => void;
  onPresent: (
    request: ViewPresentationRequest
  ) => Promise<PresentResult>;
  onReview: (
    request: Exclude<PresentRequest, { review: 'next' }>
  ) => Promise<PresentResult>;
  onDeliver: (lease: OperationLeaseToken) => Promise<
    FileOperationRunResult<ArtifactFile>
  >;
  getVisualReviews: (
    projectId: string,
    revision: string
  ) => readonly VisualReviewReceipt[];
  operationLease: OperationLease;
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
  projectGeneration,
  assets,
  activity,
  commandOutcomes,
  selectedNodeId,
  report,
  dispatch,
  onFocusEntity,
  onPresent,
  onReview,
  onDeliver,
  getVisualReviews,
  operationLease
}: UseAgentCommandPortInput): AgentCommandPortStatus => {
  const [status, setStatus] =
    useState<AgentCommandPortStatus>('connected');
  const mountedRef = useRef(true);
  const pendingRef = useRef<PendingCommand | null>(null);
  const documentRef = useLatestValue(document);
  const projectGenerationRef =
    useLatestValue(projectGeneration);
  const activityRef = useLatestValue(activity);
  const assetsRef = useLatestValue(assets);
  const selectedNodeIdRef = useLatestValue(selectedNodeId);
  const reportRef = useLatestValue(report);
  const onFocusEntityRef = useLatestValue(onFocusEntity);
  const onPresentRef = useLatestValue(onPresent);
  const onReviewRef = useLatestValue(onReview);
  const onDeliverRef = useLatestValue(onDeliver);
  const getVisualReviewsRef = useLatestValue(getVisualReviews);

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
            assetsRef.current,
            getVisualReviewsRef.current(
              documentRef.current.id,
              documentRef.current.revision
            ),
            operationLease.currentOwner()
          ),
        currentProjectId: () => documentRef.current.id,
        currentProjectSession: () =>
          `${projectGenerationRef.current}:${documentRef.current.id}`,
        currentRevision: () => documentRef.current.revision,
        submit,
        operationLease,
        present: (request: PresentRequest) => {
          if (request.review !== 'next') {
            return onReviewRef.current(request);
          }
          const current = documentRef.current;
          const readiness = evaluateProductionReadiness(
            current,
            reportRef.current
          );
          if (!readiness.mechanicallyReady) {
            return Promise.resolve({
              ok: false,
              revision: current.revision,
              error: {
                code: 'invalid_state',
                path:
                  readiness.firstBlockingFinding?.path ?? '$',
                expected:
                  readiness.firstBlockingFinding?.fix ??
                  'mechanically ready project before visual review'
              }
            });
          }
          const visualReviews = getVisualReviewsRef.current(
            current.id,
            current.revision
          );
          const rejected = visualReviews.find(
            (receipt) => receipt.verdict === 'rejected'
          );
          if (rejected) {
            return Promise.resolve({
              ok: false,
              revision: current.revision,
              error: {
                code: 'invalid_state',
                path: 'review',
                expected:
                  `revise rejected visual issues: ${rejected.issues.join(', ')}`
              }
            });
          }
          const review = nextVisualReview(
            current,
            readiness,
            visualReviews
          );
          if (!review) {
            return Promise.resolve({
              ok: false,
              revision: current.revision,
              error: {
                code: 'invalid_state',
                path: 'review',
                expected:
                  'a remaining revision-bound visual review from inspect'
              }
            });
          }
          return onPresentRef.current({
            ...review,
            timeSeconds: 0
          });
        },
        deliver: (lease) => {
          const current = documentRef.current;
          return deliverAgentProject({
            document: current,
            report: reportRef.current,
            visualReviews: getVisualReviewsRef.current(
              current.id,
              current.revision
            ),
            currentDocument: () => documentRef.current,
            exportTarget: () => onDeliverRef.current(lease)
          });
        },
        onStatusChange: (nextStatus) => {
          if (mountedRef.current) setStatus(nextStatus);
        }
      }),
    [operationLease, submit]
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
