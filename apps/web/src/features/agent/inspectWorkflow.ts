import {
  CANONICAL_IDLE_CLIP_ID,
  listAgentCommandDefinitions,
  isProductionIdleClipName,
  projectGroundingCorrection,
  readCompiledParts,
  type InvariantFinding,
  type ProductionReadinessFinding,
  type ProductionReadinessReport,
  type ProjectCommandOperation,
  type ProjectDocument,
  type ValidationReport
} from '@ashfox/engine-core';

import {
  rejectedVisualReviewsForRevision,
  type VisualReviewReceipt
} from './presentationReview';
import {
  remainingVisualReviews,
  visualReviewKey
} from './visualReviewPlan';
import {
  WORKBENCH_PLACEHOLDER_PROJECT_ID
} from '../../application/projectIdentity';

export type InspectWorkflowStage =
  | 'start'
  | 'plan'
  | 'model'
  | 'animate'
  | 'review'
  | 'deliver';

export interface InspectWorkflowBlocker {
  code: string;
  path: string;
  fix: string;
}

export type InspectWorkflowAction =
  | {
      kind: 'operation';
      operation: ProjectCommandOperation;
    }
  | {
      kind: 'command';
      name: string;
    }
  | {
      kind: 'present';
      request: { review: 'next' };
    }
  | {
      kind: 'deliver';
    };

export interface InspectWorkflowGuidance {
  stage: InspectWorkflowStage;
  blocker: InspectWorkflowBlocker | null;
  nextActions: readonly InspectWorkflowAction[];
  remainingVisualReviews: readonly string[];
  remainingVisualReviewCount: number;
  visualReviewsTruncated: boolean;
}

type ReadinessFinding =
  | InvariantFinding
  | ProductionReadinessFinding;

const VISUAL_REVIEW_RESPONSE_LIMIT = 5;

const registeredAgentCommands = new Set(
  listAgentCommandDefinitions().map(
    (definition): string => definition.name
  )
);

const commandAction = (
  name: string
): InspectWorkflowAction | null =>
  registeredAgentCommands.has(name)
    ? { kind: 'command', name }
    : null;

const commandActions = (
  names: readonly string[]
): readonly InspectWorkflowAction[] =>
  names
    .flatMap((name) => {
      const action = commandAction(name);
      return action ? [action] : [];
    })
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
  if (
    blocker.code === 'production.idle_channels_missing'
  ) {
    return true;
  }
  if (blocker.code !== 'production.idle_loop_invalid') {
    return false;
  }
  const clip =
    document.animations[CANONICAL_IDLE_CLIP_ID];
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

const isBlocking = (finding: InvariantFinding): boolean =>
  finding.severity === 'error' || finding.severity === 'warning';

const hasCode = (
  finding: { readonly code: string },
  ...prefixes: readonly string[]
): boolean =>
  prefixes.some((prefix) => finding.code.startsWith(prefix));

const firstMatching = (
  findings: readonly ReadinessFinding[],
  predicate: (finding: ReadinessFinding) => boolean
): ReadinessFinding | null =>
  findings.find(predicate) ?? null;

const isProjectRootPath = (path: string): boolean =>
  [
    'schemaVersion',
    'id',
    'name',
    'revision',
    'createdAt',
    'updatedAt'
  ].includes(path) ||
  path.startsWith('formatProfile.') ||
  path.startsWith('settings.');

const startupFinding = (
  findings: readonly ReadinessFinding[]
): ReadinessFinding | null =>
  firstMatching(
    findings,
    (finding) =>
      isProjectRootPath(finding.path) &&
      hasCode(
        finding,
        'document.',
        'identity.',
        'format.invalid_namespace',
        'format.invalid_resource_path',
        'format.invalid_identifier'
      ) &&
      finding.code !== 'document.invalid_intent'
  );

const intentFinding = (
  findings: readonly ReadinessFinding[]
): ReadinessFinding | null =>
  firstMatching(
    findings,
    (finding) =>
      finding.code === 'document.invalid_intent' ||
      hasCode(
        finding,
        'production.intent_missing',
        'production.intent_invalid'
      )
  );

const geometryFinding = (
  findings: readonly ReadinessFinding[]
): ReadinessFinding | null =>
  firstMatching(
    findings,
    (finding) => finding.code === 'production.geometry_missing'
  );

const animationFinding = (
  findings: readonly ReadinessFinding[]
): ReadinessFinding | null =>
  firstMatching(
    findings,
    (finding) =>
      finding.path.startsWith('animations.') ||
      hasCode(
        finding,
        'animation.',
        'production.idle_',
        'production.animation_'
      )
  );

const authoringFinding = (
  findings: readonly ReadinessFinding[]
): ReadinessFinding | null =>
  firstMatching(
    findings,
    (finding) =>
      finding.path.startsWith('scene.') ||
      finding.path.startsWith('modeling.') ||
      finding.path.startsWith('textures.') ||
      hasCode(
        finding,
        'scene.',
        'model.',
        'cube.',
        'mesh.',
        'texture.',
        'production.texture_',
        'production.intent_grounding_',
        'production.intent_evaluation_',
        'format.unbaked_',
        'format.coordinate_',
        'format.rotation_',
        'format.texture_',
        'format.uv_'
      )
  );

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
      blocker.code ===
        'production.animation_loop_invalid' ||
      blocker.code ===
        'production.animation_preview_unfaithful' ||
      blocker.code ===
        'production.animation_export_unsupported'
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
  if (
    blocker.code ===
    'production.intent_grounding_mismatch'
  ) {
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
  if (stage === 'plan') return ['project.intent.set'];
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
    hasCode(
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
    hasCode(
      blocker ?? { code },
      'animation.',
      'production.idle_',
      'production.animation_'
    )
  ) {
    return ['animation.motion.upsert'];
  }
  if (stage === 'model') return ['model.parts.upsert'];
  return [];
};

const reviewCommands = (
  receipt: VisualReviewReceipt
): readonly string[] => {
  const issues = new Set(receipt.issues);
  if (issues.has('motion') || issues.has('pivot')) {
    return ['animation.motion.upsert', 'model.parts.upsert'];
  }
  if (issues.has('material')) {
    return ['model.parts.material', 'model.parts.upsert'];
  }
  return ['model.parts.upsert'];
};

const fallbackFix = (
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

export const deriveInspectWorkflow = (
  document: ProjectDocument,
  report: ValidationReport,
  readiness: ProductionReadinessReport,
  visualReviews: readonly VisualReviewReceipt[] = []
): InspectWorkflowGuidance => {
  if (document.id === WORKBENCH_PLACEHOLDER_PROJECT_ID) {
    return {
      stage: 'start',
      blocker: {
        code: 'workflow.project_not_initialized',
        path: 'id',
        fix:
          'Create the requested project, then inspect again.'
      },
      nextActions: commandActions(['project.create']),
      remainingVisualReviews: [],
      remainingVisualReviewCount: 0,
      visualReviewsTruncated: false
    };
  }

  const findings: readonly ReadinessFinding[] = [
    ...report.findings.filter(isBlocking),
    ...readiness.findings
  ];
  const startup = startupFinding(findings);
  const intent = intentFinding(findings);
  const geometry = geometryFinding(findings);
  const authoring = authoringFinding(findings);
  const animation = animationFinding(findings);
  const remaining = remainingVisualReviews(
    document,
    readiness,
    visualReviews
  );
  const rejected = rejectedVisualReviewsForRevision(
    visualReviews,
    document.id,
    document.revision
  )[0] ?? null;

  let stage: InspectWorkflowStage;
  let blocker: ReadinessFinding | null;
  if (startup) {
    stage = 'start';
    blocker = startup;
  } else if (intent) {
    stage = 'plan';
    blocker = intent;
  } else if (geometry) {
    stage = 'model';
    blocker = geometry;
  } else if (authoring) {
    stage = 'model';
    blocker = authoring;
  } else if (animation) {
    stage = 'animate';
    blocker = animation;
  } else if (!readiness.mechanicallyReady) {
    stage = 'model';
    blocker = readiness.firstBlockingFinding;
  } else if (rejected) {
    stage = 'review';
    blocker = null;
  } else if (remaining.length > 0) {
    stage = 'review';
    blocker = null;
  } else {
    stage = 'deliver';
    blocker = null;
  }

  const exact = exactOperationFor(document, blocker);
  const nextActions: readonly InspectWorkflowAction[] =
    rejected
      ? commandActions(reviewCommands(rejected))
      : stage === 'review'
        ? [{ kind: 'present', request: { review: 'next' } }]
        : stage === 'deliver'
          ? [{ kind: 'deliver' }]
          : exact
            ? [{ kind: 'operation', operation: exact }]
            : commandActions(commandNamesFor(stage, blocker));
  const workflowBlocker: InspectWorkflowBlocker | null =
    rejected
      ? {
          code: 'review.rejected',
          path: `review.${visualReviewKey(rejected)}`,
          fix:
            `Revise the rejected visual issues: ${rejected.issues.join(', ')}.`
        }
      : blocker
        ? {
            code: blocker.code,
            path: blocker.path,
            fix:
              exact
                ? fallbackFix(stage, nextActions)
                : blocker.fix ??
                  fallbackFix(stage, nextActions)
          }
        : null;

  return {
    stage,
    blocker: workflowBlocker,
    nextActions,
    remainingVisualReviews:
      remaining
        .slice(0, VISUAL_REVIEW_RESPONSE_LIMIT)
        .map(visualReviewKey),
    remainingVisualReviewCount: remaining.length,
    visualReviewsTruncated:
      remaining.length > VISUAL_REVIEW_RESPONSE_LIMIT
  };
};
