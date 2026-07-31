import {
  listAgentCommandDefinitions,
  type InvariantFinding,
  type ProductionReadinessFinding,
  type ProductionReadinessReport,
  type ProjectDocument,
  type ValidationReport
} from '@ashfox/engine-core';

import {
  visualReviewsForRevision,
  type VisualReviewReceipt
} from './presentationReview';
import {
  WORKBENCH_PLACEHOLDER_PROJECT_ID
} from '../../application/projectIdentity';

export type InspectWorkflowStage =
  | 'start'
  | 'specify'
  | 'prove'
  | 'author'
  | 'animate'
  | 'review'
  | 'produce';

export interface InspectWorkflowBlocker {
  code: string;
  path: string;
  fix: string;
}

export interface InspectWorkflowGuidance {
  stage: InspectWorkflowStage;
  blocker: InspectWorkflowBlocker | null;
  recommendedCommands: readonly string[];
  remainingVisualReviews: readonly string[];
  remainingVisualReviewCount: number;
  visualReviewsTruncated: boolean;
}

type ReadinessFinding =
  | InvariantFinding
  | ProductionReadinessFinding;

const VISUAL_REVIEW_CAMERAS = [
  'perspective',
  'front',
  'side',
  'top'
] as const;
const VISUAL_REVIEW_RESPONSE_LIMIT = 5;

const registeredAgentCommands = new Set(
  listAgentCommandDefinitions().map(
    (definition): string => definition.name
  )
);

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
        'production.animation_',
        'production.intent_required_clip_'
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
        'production.intent_required_part_',
        'production.intent_required_material_',
        'production.intent_grounding_',
        'production.intent_symmetry_',
        'production.intent_evaluation_',
        'format.unbaked_',
        'format.coordinate_',
        'format.rotation_',
        'format.texture_',
        'format.uv_'
      )
  );

const recommendedFor = (
  document: ProjectDocument,
  stage: InspectWorkflowStage,
  blocker: ReadinessFinding | null
): readonly string[] => {
  const code = blocker?.code ?? '';
  let candidates: readonly string[];
  if (stage === 'start') {
    candidates = blocker?.path === 'settings.surfacePixelDensity'
      ? ['textures.density.set']
      : blocker?.path.startsWith('formatProfile.')
        ? ['project.target.set']
        : ['project.create'];
  } else if (stage === 'specify') {
    candidates = ['project.intent.set'];
  } else if (stage === 'prove') {
    candidates = ['model.parts.upsert'];
  } else if (
    (blocker?.entityIds ?? []).some(
      (id) => document.scene.nodes[id]?.kind === 'locator'
    ) ||
    hasCode(blocker ?? { code }, 'locator.')
  ) {
    candidates = [
      'scene.locators.update',
      'scene.locators.delete'
    ];
  } else if (
    hasCode(
      blocker ?? { code },
      'production.intent_grounding_'
    )
  ) {
    candidates = ['model.parts.transform', 'model.parts.upsert'];
  } else if (
    hasCode(
      blocker ?? { code },
      'production.intent_symmetry_'
    )
  ) {
    candidates = ['model.parts.mirror', 'model.parts.upsert'];
  } else if (
    hasCode(
      blocker ?? { code },
      'production.texture_',
      'production.intent_required_material_',
      'texture.',
      'cube.texture_',
      'format.texture_',
      'format.uv_'
    )
  ) {
    candidates = ['model.parts.upsert', 'model.parts.material'];
  } else if (code === 'production.idle_missing') {
    candidates = [
      'animation.clip.upsert',
      'animation.channels.upsert',
      'animation.clip.closeLoop'
    ];
  } else if (
    code === 'production.idle_channels_missing' ||
    code === 'production.intent_required_clip_channels_missing'
  ) {
    candidates = [
      'animation.channels.upsert',
      'animation.clip.closeLoop'
    ];
  } else if (
    code === 'production.idle_loop_invalid' ||
    code === 'animation.invalid_loop'
  ) {
    candidates = [
      'animation.clip.closeLoop',
      'animation.channels.upsert'
    ];
  } else if (
    stage === 'animate' ||
    hasCode(
      blocker ?? { code },
      'animation.',
      'production.animation_',
      'production.intent_required_clip_'
    )
  ) {
    candidates = [
      'animation.channels.upsert',
      'animation.tracks.delete',
      'animation.clip.upsert'
    ];
  } else if (stage === 'author') {
    candidates = ['model.parts.upsert'];
  } else {
    candidates = [];
  }
  return candidates
    .filter((name) => registeredAgentCommands.has(name))
    .slice(0, 3);
};

const fallbackFix = (
  stage: InspectWorkflowStage,
  commands: readonly string[]
): string => {
  const command = commands[0];
  if (command) {
    return `Correct the reported path with ${command}, then inspect again.`;
  }
  if (stage === 'review') {
    return 'Complete the remaining visual reviews on the current revision.';
  }
  return 'Correct the reported path, then inspect again.';
};

const visualReviewKey = (
  mode: 'frame' | 'cycle',
  camera: 'perspective' | 'front' | 'side' | 'top',
  clipId: string | null
): string =>
  clipId === null
    ? `${mode}:${camera}`
    : `${mode}:${camera}:${clipId}`;

const remainingVisualReviews = (
  document: ProjectDocument,
  readiness: ProductionReadinessReport,
  receipts: readonly VisualReviewReceipt[]
): readonly string[] => {
  if (readiness.counts.visibleGeometry === 0) return [];
  const currentReceipts = visualReviewsForRevision(
    receipts,
    document.id,
    document.revision
  );
  const completed = new Set(
    currentReceipts.flatMap((receipt) => {
      if (
        receipt.mode === 'cycle' &&
        receipt.completedCycles < 1
      ) {
        return [];
      }
      return [
        visualReviewKey(
          receipt.mode,
          receipt.camera,
          receipt.clipId
        )
      ];
    })
  );
  const required = [
    ...VISUAL_REVIEW_CAMERAS.map((camera) =>
      visualReviewKey('frame', camera, null)
    ),
    ...Object.keys(document.animations)
      .sort()
      .map((clipId) =>
        visualReviewKey('cycle', 'perspective', clipId)
      )
  ];
  return required.filter((review) => !completed.has(review));
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
          'Create the requested project with project.create, then inspect again.'
      },
      recommendedCommands: ['project.create'],
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

  let stage: InspectWorkflowStage;
  let blocker: ReadinessFinding | null;
  if (startup) {
    stage = 'start';
    blocker = startup;
  } else if (intent) {
    stage = 'specify';
    blocker = intent;
  } else if (geometry) {
    stage = 'prove';
    blocker = geometry;
  } else if (authoring) {
    stage = 'author';
    blocker = authoring;
  } else if (animation) {
    stage = 'animate';
    blocker = animation;
  } else if (!readiness.mechanicallyReady) {
    stage = 'author';
    blocker = readiness.firstBlockingFinding;
  } else if (remaining.length > 0) {
    stage = 'review';
    blocker = null;
  } else {
    stage = 'produce';
    blocker = null;
  }

  const recommendedCommands = recommendedFor(
    document,
    stage,
    blocker
  );
  return {
    stage,
    blocker: blocker
      ? {
          code: blocker.code,
          path: blocker.path,
          fix:
            blocker.fix ??
            fallbackFix(stage, recommendedCommands)
        }
      : null,
    recommendedCommands,
    remainingVisualReviews:
      remaining.slice(0, VISUAL_REVIEW_RESPONSE_LIMIT),
    remainingVisualReviewCount: remaining.length,
    visualReviewsTruncated:
      remaining.length > VISUAL_REVIEW_RESPONSE_LIMIT
  };
};
