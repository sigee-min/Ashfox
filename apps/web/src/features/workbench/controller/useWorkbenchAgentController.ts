'use client';

import type {
  Dispatch,
  SetStateAction
} from 'react';

import type {
  CommandReceipt,
  ProjectDocument,
  ValidationReport
} from '@ashfox/engine-core';

import type {
  CommandOutcome
} from '../../../application/commandOutcome';
import type {
  HistoryAction
} from '../../../application/historyReducer';
import type {
  OperationLease,
  OperationLeaseToken
} from '../../../application/operationLease';
import type {
  ProjectAssets
} from '../../../application/projectAssets';
import {
  useAgentCommandPort
} from '../../agent/useAgentCommandPort';
import type {
  VisualReviewReceipt
} from '../../../application/visualReviewReceipt';
import {
  useAgentPresentation
} from '../hooks/useAgentPresentation';
import type {
  ArtifactFile
} from '../../files/artifactFile';
import type {
  CaptureArtifactRequest
} from '../../files/captureArtifactRequest';
import type {
  FileOperationRunResult
} from '../../files/useFileOperation';
import type {
  CameraCommand
} from '../viewport/viewportTypes';

interface UseWorkbenchAgentControllerInput {
  document: ProjectDocument;
  projectGeneration: number;
  assets: ProjectAssets;
  activity: readonly CommandReceipt[];
  visualReviews: readonly VisualReviewReceipt[];
  onRecordVisualReview: (receipt: VisualReviewReceipt) => void;
  commandOutcomes: readonly CommandOutcome[];
  selectedNodeId: string | null;
  report: ValidationReport;
  dispatch: Dispatch<HistoryAction>;
  buildDocuments: readonly ProjectDocument[];
  operationLease: OperationLease;
  selectNode: (nodeId: string | null) => void;
  prepareView: (request: {
    clipId: string | null;
    camera: CameraCommand['mode'];
  }) => void;
  setPlayhead: Dispatch<SetStateAction<number>>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  capture: (
    request: CaptureArtifactRequest,
    lease: OperationLeaseToken
  ) => Promise<FileOperationRunResult<ArtifactFile>>;
}

export const useWorkbenchAgentController = ({
  document,
  projectGeneration,
  assets,
  activity,
  visualReviews,
  onRecordVisualReview,
  commandOutcomes,
  selectedNodeId,
  report,
  dispatch,
  buildDocuments,
  operationLease,
  selectNode,
  prepareView,
  setPlayhead,
  setPlaying,
  capture
}: UseWorkbenchAgentControllerInput) => {
  const {
    presentationNonce,
    present,
    review,
    onPresented,
    getVisualReviews
  } = useAgentPresentation({
    document,
    visualReviews,
    onRecordVisualReview,
    prepareView,
    setPlayhead,
    setPlaying
  });

  const status = useAgentCommandPort({
    document,
    projectGeneration,
    assets,
    activity,
    commandOutcomes,
    selectedNodeId,
    report,
    dispatch,
    onFocusEntity: selectNode,
    onPresent: present,
    onReview: review,
    onCapture: capture,
    buildDocuments,
    getVisualReviews,
    operationLease
  });

  return {
    status,
    presentationNonce,
    onPresented
  };
};
