import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch
} from 'react';

import {
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
  TargetArtifactFile
} from '../files/browserFileWorkflow';
import type {
  CaptureArtifactRequest
} from '../files/captureArtifactRequest';
import type {
  FileOperationRunResult
} from '../files/useFileOperation';
import { useLatestValue } from '../../hooks/useLatestValue';
import {
  AgentCommandPort,
  type AgentCommandPortStatus
} from './AgentCommandPort';
import { inspectProject } from './inspect';
import {
  presentAgentProject
} from './presentAgentProject';
import {
  useAgentCommandSubmission
} from './port/useAgentCommandSubmission';
import type {
  VisualReviewReceipt
} from './presentationReview';
import type {
  AgentCaptureRequest,
  PresentRequest,
  PresentResult,
  ViewPresentationRequest
} from './types';
import {
  deliverAgentProject
} from './deliverAgentProject';
import {
  captureAgentProject
} from './captureAgentProject';

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
    FileOperationRunResult<TargetArtifactFile>
  >;
  onCapture: (
    request: CaptureArtifactRequest,
    lease: OperationLeaseToken
  ) => Promise<FileOperationRunResult<ArtifactFile>>;
  buildDocuments: readonly ProjectDocument[];
  getVisualReviews: (
    projectId: string,
    revision: string
  ) => readonly VisualReviewReceipt[];
  operationLease: OperationLease;
}

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
  onCapture,
  buildDocuments,
  getVisualReviews,
  operationLease
}: UseAgentCommandPortInput): AgentCommandPortStatus => {
  const [status, setStatus] =
    useState<AgentCommandPortStatus>('connected');
  const mountedRef = useRef(true);
  const documentRef = useLatestValue(document);
  const projectGenerationRef =
    useLatestValue(projectGeneration);
  const activityRef = useLatestValue(activity);
  const assetsRef = useLatestValue(assets);
  const selectedNodeIdRef = useLatestValue(selectedNodeId);
  const reportRef = useLatestValue(report);
  const onPresentRef = useLatestValue(onPresent);
  const onReviewRef = useLatestValue(onReview);
  const onDeliverRef = useLatestValue(onDeliver);
  const onCaptureRef = useLatestValue(onCapture);
  const buildDocumentsRef = useLatestValue(buildDocuments);
  const getVisualReviewsRef = useLatestValue(getVisualReviews);
  const { submit, cancelPending } = useAgentCommandSubmission({
    document,
    commandOutcomes,
    dispatch,
    onFocusEntity
  });

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
          const current = documentRef.current;
          return presentAgentProject({
            request,
            document: current,
            report: reportRef.current,
            visualReviews: getVisualReviewsRef.current(
              current.id,
              current.revision
            ),
            review: onReviewRef.current,
            present: onPresentRef.current
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
        capture: (
          request: AgentCaptureRequest,
          lease: OperationLeaseToken
        ) => {
          const current = documentRef.current;
          return captureAgentProject({
            request,
            document: current,
            report: reportRef.current,
            visualReviews: getVisualReviewsRef.current(
              current.id,
              current.revision
            ),
            buildDocuments: buildDocumentsRef.current,
            activity: activityRef.current,
            currentDocument: () => documentRef.current,
            capture: onCaptureRef.current,
            lease
          });
        },
        onStatusChange: (nextStatus) => {
          if (mountedRef.current) setStatus(nextStatus);
        }
      }),
    [operationLease, submit]
  );

  useEffect(() => {
    mountedRef.current = true;
    const disconnect = port.connect(window);
    return () => {
      mountedRef.current = false;
      disconnect();
      cancelPending();
    };
  }, [cancelPending, port]);

  return status;
};
