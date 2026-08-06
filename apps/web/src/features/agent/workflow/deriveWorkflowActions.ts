import {
  CANONICAL_IDLE_CLIP_ID,
  isProductionIdleClipName,
  listAgentCommandDefinitions,
  projectGroundingCorrection,
  readCompiledParts,
  type ProjectCommandOperation,
  type ProjectDocument
} from '@ashfox/engine-core';

import type {
  VisualReviewReceipt
} from '../../../application/visualReviewReceipt';
import {
  findingHasCode
} from './classifyWorkflowFinding';
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
  listAgentCommandDefinitions().map(
    (definition): string => definition.name
  )
);

const commandActions = (
  names: readonly string[]
): readonly InspectWorkflowAction[] =>
  names
    .flatMap((name) =>
      registeredAgentCommands.has(name)
        ? [{ kind: 'command' as const, name }]
        : []
    )
    .slice(0, 3);

const canonicalStaticIdleOperation = (
  document: ProjectDocument
): ProjectCommandOperation | null => {
  const compiled = readCompiledParts(document);
  if (
    !compiled.ok ||
    ![...compiled.parts.values()].some(
      (part) => part.parentPartId === null
    )
  ) {
    return null;
  }
  return {
    name: 'animation.motion.upsert',
    payload: {
      clipId: CANONICAL_IDLE_CLIP_ID,
      role: 'idle',
      durationFrames: 20,
      static: true
    }
  };
};

const idleRequiresReplacement = (
  document: ProjectDocument,
  blocker: ReadinessFinding
): boolean => {
  if (blocker.code === 'production.idle_channels_missing') {
    return true;
  }
  if (blocker.code !== 'production.idle_loop_invalid') {
    return false;
  }
  const clip = document.animations[CANONICAL_IDLE_CLIP_ID];
  const compiled = readCompiledParts(document);
  if (!clip || !compiled.ok) return true;
  const partsByBoneId = new Map(
    [...compiled.parts.values()].map(
      (part) => [part.bone.id, part]
    )
  );
  return Object.values(clip.channels).some((channel) => {
    const part = partsByBoneId.get(channel.targetNodeId);
    return (
      channel.property !== 'rotation' ||
      part === undefined ||
      (
        part.parentPartId !== null &&
        part.joint.kind === 'fixed'
      )
    );
  });
};

const exactOperationFor = (
  document: ProjectDocument,
  blocker: ReadinessFinding | null
): ProjectCommandOperation | null => {
  if (!blocker) return null;
  if (blocker.code === 'production.idle_missing') {
    const nonCanonicalIdle = Object.values(
      document.animations
    ).find(
      (clip) =>
        clip.id !== CANONICAL_IDLE_CLIP_ID &&
        isProductionIdleClipName(clip.name)
    );
    return nonCanonicalIdle
      ? {
          name: 'animation.clip.delete',
          payload: { clipId: nonCanonicalIdle.id }
        }
      : canonicalStaticIdleOperation(document);
  }
  if (
    idleRequiresReplacement(document, blocker) &&
    document.animations[CANONICAL_IDLE_CLIP_ID]
  ) {
    return {
      name: 'animation.clip.delete',
      payload: { clipId: CANONICAL_IDLE_CLIP_ID }
    };
  }
  if (
    (
      blocker.code === 'production.animation_loop_invalid' ||
      blocker.code === 'production.animation_preview_unfaithful' ||
      blocker.code === 'production.animation_export_unsupported'
    ) &&
    blocker.clipIds?.length === 1 &&
    document.animations[blocker.clipIds[0]]
  ) {
    return {
      name: 'animation.clip.delete',
      payload: { clipId: blocker.clipIds[0] }
    };
  }
  const locatorIds = (blocker.entityIds ?? []).filter(
    (id) => document.scene.nodes[id]?.kind === 'locator'
  );
  if (locatorIds.length > 0) {
    return {
      name: 'scene.locators.delete',
      payload: { locatorIds }
    };
  }
  if (blocker.code === 'production.intent_grounding_mismatch') {
    const correction = projectGroundingCorrection(document);
    if (correction) {
      return {
        name: 'model.parts.transform',
        payload: correction
      };
    }
  }
  return null;
};

const commandNamesFor = (
  stage: InspectWorkflowStage,
  blocker: ReadinessFinding | null
): readonly string[] => {
  const code = blocker?.code ?? '';
  if (stage === 'start') {
    return blocker?.path === 'settings.surfacePixelDensity'
      ? ['textures.density.set']
      : blocker?.path.startsWith('formatProfile.')
        ? ['project.target.set']
        : ['project.create'];
  }
  if (stage === 'plan') {
    return findingHasCode(
      blocker ?? { code },
      'document.invalid_authoring_profile',
      'production.authoring_profile_',
      'production.authoring_routing_',
      'production.authoring_compatibility_'
    )
      ? ['project.authoring.configure']
      : ['project.intent.set'];
  }
  if (code === 'production.intent_grounding_mismatch') {
    return ['model.parts.transform'];
  }
  if (code === 'production.intent_grounding_unverifiable') {
    return ['project.intent.set'];
  }
  if (
    code === 'production.intent_grounding_unstable' ||
    code === 'production.intent_evaluation_unavailable'
  ) {
    return ['model.parts.upsert'];
  }
  if (
    findingHasCode(
      blocker ?? { code },
      'production.authoring_slot_',
      'production.authoring_attachment_'
    )
  ) {
    return ['model.parts.upsert'];
  }
  if (findingHasCode(
    blocker ?? { code },
    'production.authoring_part_unassigned'
  )) {
    return ['project.authoring.configure', 'model.parts.delete'];
  }
  if (
    findingHasCode(
      blocker ?? { code },
      'production.texture_',
      'texture.',
      'cube.texture_',
      'format.texture_',
      'format.uv_'
    )
  ) {
    return ['model.parts.upsert', 'model.parts.material'];
  }
  if (
    stage === 'animate' ||
    findingHasCode(
      blocker ?? { code },
      'animation.',
      'production.idle_',
      'production.animation_',
      'production.authoring_motion_'
    )
  ) {
    return ['animation.motion.upsert'];
  }
  if (stage === 'model') return ['model.parts.upsert'];
  return [];
};

const commandsForRejectedReview = (
  receipt: VisualReviewReceipt
): readonly string[] => {
  const issues = new Set(receipt.decision.issues);
  if (issues.has('motion') || issues.has('pivot')) {
    return ['animation.motion.upsert', 'model.parts.upsert'];
  }
  if (issues.has('material')) {
    return ['model.parts.material', 'model.parts.upsert'];
  }
  return ['model.parts.upsert'];
};

export const deriveWorkflowActions = (
  document: ProjectDocument,
  stage: InspectWorkflowStage,
  blocker: ReadinessFinding | null,
  rejectedReview: VisualReviewReceipt | null
): DerivedWorkflowActions => {
  const exactOperation = exactOperationFor(document, blocker);
  const nextActions: readonly InspectWorkflowAction[] = rejectedReview
    ? commandActions(commandsForRejectedReview(rejectedReview))
    : stage === 'review'
      ? [{ kind: 'present', request: { review: 'next' } }]
      : stage === 'deliver'
        ? [{ kind: 'deliver' }]
        : exactOperation
          ? [{ kind: 'operation', operation: exactOperation }]
          : commandActions(commandNamesFor(stage, blocker));
  return { exactOperation, nextActions };
};

export const fallbackWorkflowFix = (
  stage: InspectWorkflowStage,
  actions: readonly InspectWorkflowAction[]
): string => {
  const first = actions[0];
  if (first?.kind === 'operation') {
    return `Apply the returned ${first.operation.name} operation, then inspect again.`;
  }
  if (first?.kind === 'command') {
    return `Correct the reported path with ${first.name}, then inspect again.`;
  }
  if (stage === 'review') {
    return 'Observe and explicitly accept or reject the next review frame.';
  }
  return 'Correct the reported path, then inspect again.';
};
