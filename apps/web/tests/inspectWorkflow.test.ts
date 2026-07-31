import assert from 'node:assert/strict';

import {
  evaluateProductionReadiness,
  validateProjectDocument
} from '@ashfox/engine-core';

import {
  createGltfProject
} from '../../../packages/engine-core/tests/helpers';
import {
  deriveInspectWorkflow
} from '../src/features/agent/inspectWorkflow';
import { inspectProject } from '../src/features/agent/inspect';
import {
  WORKBENCH_PLACEHOLDER_PROJECT_ID
} from '../src/application/projectIdentity';
import type {
  VisualReviewReceipt
} from '../src/features/agent/presentationReview';

const readyProject = structuredClone(createGltfProject());
readyProject.intent = {
  subject: 'wooden crate',
  forward: 'north',
  grounding: 'free',
  requiredFeatures: ['readable crate silhouette'],
  requiredPartIds: [],
  requiredMaterialIds: [],
  requiredClipIds: []
};
const idle = readyProject.animations['clip-idle'];
const idleChannel = idle.channels['channel-root-rotation'];
readyProject.animations = {
  ...readyProject.animations,
  'clip-idle': {
    ...idle,
    channels: {
      ...idle.channels,
      'channel-root-rotation': {
        ...idleChannel,
        keys: idleChannel.keys.map((key, index) =>
          index === idleChannel.keys.length - 1
            ? { ...key, value: [0, 0, 0] }
            : key
        )
      }
    }
  }
};

const readyReport = validateProjectDocument(readyProject);
const readyReadiness = evaluateProductionReadiness(
  readyProject,
  readyReport
);
assert.equal(readyReadiness.mechanicallyReady, true);

const unreviewed = deriveInspectWorkflow(
  readyProject,
  readyReport,
  readyReadiness
);
assert.deepEqual(unreviewed, {
  stage: 'review',
  blocker: null,
  recommendedCommands: [],
  remainingVisualReviews: [
    'frame:perspective',
    'frame:front',
    'frame:side',
    'frame:top',
    'cycle:perspective:clip-idle'
  ],
  remainingVisualReviewCount: 5,
  visualReviewsTruncated: false
});

const receipt = (
  mode: 'frame' | 'cycle',
  camera: 'perspective' | 'front' | 'side' | 'top',
  clipId: string | null,
  revision = readyProject.revision
): VisualReviewReceipt => ({
  projectId: readyProject.id,
  revision,
  mode,
  camera,
  clipId,
  observedTimeSeconds: 1,
  completedCycles: mode === 'cycle' ? 1 : 0,
  frameNonce: 1
});

const completeReceipts = [
  receipt('frame', 'perspective', null),
  receipt('frame', 'front', null),
  receipt('frame', 'side', null),
  receipt('frame', 'top', null),
  receipt('cycle', 'perspective', 'clip-idle')
];
const reviewed = deriveInspectWorkflow(
  readyProject,
  readyReport,
  readyReadiness,
  completeReceipts
);
assert.equal(reviewed.stage, 'deliver');
assert.deepEqual(reviewed.remainingVisualReviews, []);
assert.equal(reviewed.remainingVisualReviewCount, 0);

const defaultInspect = inspectProject(
  readyProject,
  null,
  readyReport,
  undefined,
  [],
  {},
  completeReceipts
);
assert.equal(defaultInspect.ok, true);
if (defaultInspect.ok) {
  const workflow = (defaultInspect.data as {
    workflow: {
      stage: string;
      remainingVisualReviews: readonly string[];
    };
  }).workflow;
  assert.equal(workflow.stage, 'deliver');
  assert.deepEqual(workflow.remainingVisualReviews, []);
}

const targetInspect = inspectProject(
  readyProject,
  null,
  readyReport,
  { kind: 'target' },
  [],
  {},
  completeReceipts
);
assert.equal(targetInspect.ok, true);
if (targetInspect.ok) {
  const workflow = (targetInspect.data as {
    workflow: {
      stage: string;
      remainingVisualReviews: readonly string[];
    };
  }).workflow;
  assert.equal(workflow.stage, 'deliver');
  assert.deepEqual(workflow.remainingVisualReviews, []);
}

const staleReview = deriveInspectWorkflow(
  readyProject,
  readyReport,
  readyReadiness,
  completeReceipts.map((item) => ({
    ...item,
    revision: 'stale-revision'
  }))
);
assert.equal(staleReview.stage, 'review');
assert.equal(staleReview.remainingVisualReviews.length, 5);
assert.equal(staleReview.remainingVisualReviewCount, 5);

const unspecified = structuredClone(createGltfProject());
const unspecifiedReport = validateProjectDocument(unspecified);
const unspecifiedGuidance = deriveInspectWorkflow(
  unspecified,
  unspecifiedReport,
  evaluateProductionReadiness(unspecified, unspecifiedReport)
);
assert.equal(unspecifiedGuidance.stage, 'plan');
assert.equal(
  unspecifiedGuidance.blocker?.code,
  'production.intent_missing'
);
assert.ok(unspecifiedGuidance.blocker?.fix);
assert.deepEqual(
  unspecifiedGuidance.recommendedCommands,
  ['project.intent.set']
);

const placeholder = {
  ...structuredClone(unspecified),
  id: WORKBENCH_PLACEHOLDER_PROJECT_ID
};
const placeholderReport = validateProjectDocument(placeholder);
const placeholderGuidance = deriveInspectWorkflow(
  placeholder,
  placeholderReport,
  evaluateProductionReadiness(placeholder, placeholderReport)
);
assert.equal(placeholderGuidance.stage, 'start');
assert.equal(
  placeholderGuidance.blocker?.code,
  'workflow.project_not_initialized'
);
assert.deepEqual(
  placeholderGuidance.recommendedCommands,
  ['project.create']
);

const locatorProject = structuredClone(readyProject);
locatorProject.scene.nodes['locator-broken'] = {
  id: 'locator-broken',
  kind: 'locator',
  name: 'broken',
  parentId: 'bone-missing',
  transform: structuredClone(
    locatorProject.scene.nodes['bone-root'].transform
  ),
  visible: true
};
const locatorReport = validateProjectDocument(locatorProject);
const locatorGuidance = deriveInspectWorkflow(
  locatorProject,
  locatorReport,
  evaluateProductionReadiness(locatorProject, locatorReport)
);
assert.equal(locatorGuidance.stage, 'model');
assert.equal(
  locatorGuidance.blocker?.code,
  'scene.parent_missing'
);
assert.deepEqual(
  locatorGuidance.recommendedCommands,
  ['scene.locators.delete']
);

const invalidAnimation = structuredClone(readyProject);
invalidAnimation.animations['clip-idle'].name = '';
const invalidAnimationReport =
  validateProjectDocument(invalidAnimation);
const invalidAnimationGuidance = deriveInspectWorkflow(
  invalidAnimation,
  invalidAnimationReport,
  evaluateProductionReadiness(
    invalidAnimation,
    invalidAnimationReport
  )
);
assert.equal(invalidAnimationGuidance.stage, 'animate');
assert.equal(
  invalidAnimationGuidance.blocker?.path,
  'animations.clip-idle.name'
);
assert.ok(
  invalidAnimationGuidance.recommendedCommands.includes(
    'animation.motion.upsert'
  )
);

const untextured = structuredClone(readyProject);
for (const node of Object.values(untextured.scene.nodes)) {
  if (node.kind !== 'cube') continue;
  for (const face of Object.values(node.faces)) {
    face.textureId = null;
  }
}
untextured.textures = {};
const untexturedReport = validateProjectDocument(untextured);
const untexturedGuidance = deriveInspectWorkflow(
  untextured,
  untexturedReport,
  evaluateProductionReadiness(untextured, untexturedReport)
);
assert.equal(untexturedGuidance.stage, 'model');
assert.match(
  untexturedGuidance.blocker?.code ?? '',
  /^(cube\.texture_missing|production\.texture_coverage_incomplete)$/
);
assert.ok(
  untexturedGuidance.recommendedCommands.includes(
    'model.parts.upsert'
  )
);

const geometryMissing = structuredClone(readyProject);
geometryMissing.scene = { roots: [], nodes: {} };
geometryMissing.textures = {};
geometryMissing.animations = {};
const geometryReport = validateProjectDocument(geometryMissing);
const geometryGuidance = deriveInspectWorkflow(
  geometryMissing,
  geometryReport,
  evaluateProductionReadiness(geometryMissing, geometryReport)
);
assert.equal(geometryGuidance.stage, 'model');
assert.equal(
  geometryGuidance.blocker?.code,
  'production.geometry_missing'
);
assert.deepEqual(
  geometryGuidance.recommendedCommands,
  ['model.parts.upsert']
);
