import {
  evaluateProductionReadiness,
  type ProjectDocument,
  type ValidationReport
} from '@ashfox/engine-core';

import type {
  ProjectAssets
} from '../../../application/projectAssets';
import {
  projectExportTargetFor
} from '../../../application/projectExportTarget';
import {
  evaluateAssetMaterialization
} from '../../files/assetMaterialization';
import {
  boundedSuccess
} from '../boundedResult';
import {
  deriveInspectWorkflow
} from '../inspectWorkflow';
import type {
  VisualReviewReceipt
} from '../presentationReview';
import type {
  InspectResult
} from '../types';
import {
  exportCompatibilitySummary
} from './exportCompatibilitySummary';
import {
  DETAIL_INSPECT_LIMIT
} from './inspectResult';

const MATERIALIZATION_ISSUE_LIMIT = 20;

export const inspectTarget = (
  document: ProjectDocument,
  report: ValidationReport,
  assets: ProjectAssets,
  visualReviews: readonly VisualReviewReceipt[]
): InspectResult => {
  const readiness = evaluateProductionReadiness(document, report);
  const workflow = deriveInspectWorkflow(
    document,
    report,
    readiness,
    visualReviews
  );
  const materialization = evaluateAssetMaterialization(
    document,
    assets
  );
  const exportTarget = projectExportTargetFor(document);
  const compatibility = exportCompatibilitySummary(document);
  return boundedSuccess(
    document.revision,
    {
      target: exportTarget.target,
      gameVersion: compatibility.gameVersion,
      animationSupport: compatibility.animationSupport,
      supportedGameVersions:
        compatibility.supportedGameVersions,
      profileId: document.formatProfile.id,
      formatProfile: document.formatProfile,
      settings: document.settings,
      structurallyValid: readiness.structurallyValid,
      mechanicallyReady: readiness.mechanicallyReady,
      semanticReviewRequired:
        readiness.semanticReviewRequired,
      artifactMaterialized: materialization.materialized,
      assetMaterialization: {
        ...materialization,
        issues: materialization.issues.slice(
          0,
          MATERIALIZATION_ISSUE_LIMIT
        ),
        issueCount: materialization.issues.length,
        issuesTruncated:
          materialization.issues.length > MATERIALIZATION_ISSUE_LIMIT
      },
      intent: document.intent ?? null,
      counts: {
        errors: readiness.counts.structuralErrors,
        warnings: readiness.counts.structuralWarnings,
        readinessErrors: readiness.findings.length,
        textures: Object.keys(document.textures).length,
        visibleGeometry: readiness.counts.visibleGeometry,
        enabledVisibleFaces:
          readiness.counts.enabledVisibleFaces,
        texturedVisibleFaces:
          readiness.counts.texturedVisibleFaces,
        untexturedVisibleFaces:
          readiness.counts.untexturedVisibleFaces,
        idleClips: readiness.counts.idleClips,
        idleChannels: readiness.counts.idleChannels,
        features: readiness.counts.features
      },
      readinessFindings: readiness.findings.slice(0, 10),
      readinessFindingsTruncated: readiness.findings.length > 10,
      firstReadinessFinding: readiness.firstBlockingFinding,
      workflow
    },
    DETAIL_INSPECT_LIMIT
  );
};
