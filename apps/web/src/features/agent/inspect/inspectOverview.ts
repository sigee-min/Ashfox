import {
  CANONICAL_IDLE_CLIP_ID,
  evaluateProductionReadiness,
  isSceneNodeEffectivelyVisible,
  type ProjectDocument,
  type ValidationReport
} from '@ashfox/engine-core';

import {
  projectExportTargetFor
} from '../../../application/projectExportTarget';
import {
  agentCommandProtocol
} from '../agentCommandProtocol';
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
  DEFAULT_INSPECT_LIMIT
} from './inspectResult';

export const inspectOverview = (
  document: ProjectDocument,
  selectedNodeId: string | null,
  report: ValidationReport,
  visualReviews: readonly VisualReviewReceipt[],
  operationOwner: string | null
): InspectResult => {
  const nodes = Object.values(document.scene.nodes);
  const clips = Object.values(document.animations);
  const readiness = evaluateProductionReadiness(document, report);
  const workflow = deriveInspectWorkflow(
    document,
    report,
    readiness,
    visualReviews
  );
  const idleClip = document.animations[CANONICAL_IDLE_CLIP_ID];
  const exportTarget = projectExportTargetFor(document);
  const compatibility = exportCompatibilitySummary(document);
  return boundedSuccess(
    document.revision,
    {
      commandPort: {
        status: operationOwner === null ? 'connected' : 'working',
        operation: operationOwner
      },
      protocol: {
        workbench: agentCommandProtocol.workbench,
        manifest: agentCommandProtocol.href,
        commandSchema: {
          kind: 'command',
          name: '<commands entry>'
        }
      },
      project: {
        id: document.id,
        name: document.name.slice(0, 120),
        revision: document.revision,
        subject: document.intent?.subject ?? null,
        forward: document.intent?.forward ?? null,
        grounding: document.intent?.grounding ?? null,
        target: exportTarget.target,
        gameVersion: compatibility.gameVersion,
        animationSupport: compatibility.animationSupport,
        supportedGameVersions:
          compatibility.supportedGameVersions,
        profileId: document.formatProfile.id,
        structurallyValid: readiness.structurallyValid,
        mechanicallyReady: readiness.mechanicallyReady,
        semanticReviewRequired:
          readiness.semanticReviewRequired,
        surfacePixelDensity:
          document.settings.surfacePixelDensity,
        textureResolution:
          document.settings.textureResolution
      },
      selection: selectedNodeId,
      counts: {
        nodes: nodes.length,
        parts: new Set(
          nodes.flatMap((node) =>
            node.generation?.authority === 'ashfox.part-compiler'
              ? [node.generation.partId]
              : []
          )
        ).size,
        bones: nodes.filter((node) => node.kind === 'bone').length,
        cubes: nodes.filter((node) => node.kind === 'cube').length,
        visibleCubes: nodes.filter(
          (node) =>
            node.kind === 'cube' &&
            isSceneNodeEffectivelyVisible(document, node.id)
        ).length,
        meshes: nodes.filter((node) => node.kind === 'mesh').length,
        locators: nodes.filter((node) => node.kind === 'locator').length,
        enabledVisibleFaces: readiness.counts.enabledVisibleFaces,
        texturedVisibleFaces: readiness.counts.texturedVisibleFaces,
        untexturedVisibleFaces:
          readiness.counts.untexturedVisibleFaces,
        textures: Object.keys(document.textures).length,
        clips: clips.length,
        channels: clips.reduce(
          (count, clip) => count + Object.keys(clip.channels).length,
          0
        ),
        triggers: clips.reduce(
          (count, clip) => count + Object.keys(clip.triggers).length,
          0
        ),
        idleClips: idleClip ? 1 : 0,
        idleChannels:
          idleClip ? Object.keys(idleClip.channels).length : 0
      },
      workflow
    },
    DEFAULT_INSPECT_LIMIT
  );
};
