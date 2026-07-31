import assert from 'node:assert/strict';

import {
  commandAllowedForSource,
  createProjectFromInput,
  evaluateProductionReadiness,
  executeCommandBatch,
  validateProjectDocument,
  type AnimationPartMotionInput,
  type CommandBatch,
  type CommandPayloadMap,
  type PartSpec,
  type ProjectDocument
} from '../src';

const root: PartSpec = {
  kind: 'plate',
  partId: 'body',
  parentPartId: null,
  materialId: 'gold',
  joint: { kind: 'fixed' },
  attachment: null,
  plane: 'xy',
  origin: [-2, 0, 0],
  outline: [[0, 0], [4, 0], [4, 4], [0, 4]],
  thickness: 4
};

const child = (
  partId: string,
  center: readonly [number, number, number],
  joint: PartSpec['joint']
): PartSpec => ({
  kind: 'mass',
  partId,
  parentPartId: 'body',
  materialId: 'gold',
  joint,
  attachment: {
    parentAnchor: center,
    partAnchor: center
  },
  center,
  radii: [1, 1, 1],
  profile: 'hard'
});

const hinge = child(
  'hinge',
  [0, 5, 1],
  { kind: 'hinge', axis: 'z' }
);
const ball = child(
  'ball',
  [3, 2, 1],
  { kind: 'ball' }
);
const fixed = child(
  'fixed',
  [-3, 2, 1],
  { kind: 'fixed' }
);

const execute = (
  document: ProjectDocument,
  batchId: string,
  operations: CommandBatch['operations'],
  source: 'agent' | 'system' = 'agent'
) =>
  executeCommandBatch(
    document,
    {
      batchId,
      baseProjectId: document.id,
      baseRevision: document.revision,
      operations
    },
    { source }
  );

const base = createProjectFromInput(
  {
    id: 'animation-motion-authoring',
    name: 'Animation motion authoring',
    target: 'geckolib5',
    namespace: 'ashfox',
    modelPath: 'motion_authoring',
    createdAt: '2026-07-31T00:00:00.000Z'
  },
  'motion-0001'
);
assert.deepEqual(
  Object.keys(base.animations),
  ['animation-rest-pose']
);
const authored = execute(base, 'author-rig', [{
  name: 'model.parts.upsert',
  payload: {
    parts: [root, hinge, ball, fixed].map(
      ({ attachment: _attachment, ...part }) => part
    ),
    materials: [{
      id: 'gold',
      baseColor: '#C58A32'
    }]
  }
}]);
assert.equal(authored.ok, true);
if (!authored.ok) throw new Error(authored.error.message);

const staticIdle = execute(
  authored.document,
  'create-static-idle',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'idle',
      role: 'idle'
    }
  }]
);
assert.equal(staticIdle.ok, true);
if (!staticIdle.ok) throw new Error(staticIdle.error.message);
assert.equal(
  staticIdle.document.animations['animation-rest-pose'],
  undefined
);
assert.ok(
  staticIdle.effects.removedEntityIds.includes(
    'animation-rest-pose'
  )
);
const idle = staticIdle.document.animations.idle;
assert.equal(idle.name, 'animation.motion_authoring.idle');
assert.equal(idle.durationSeconds, 1);
assert.equal(idle.fps, 20);
assert.equal(idle.loop, 'loop');
assert.deepEqual(Object.keys(idle.channels), [
  'animation:idle:channel:body:rotation'
]);
const staticKeys = Object.values(idle.channels)[0].keys;
assert.deepEqual(
  staticKeys.map((key) => [key.timeSeconds, key.value]),
  [
    [0, [0, 0, 0]],
    [1, [0, 0, 0]]
  ]
);
assert.equal(validateProjectDocument(staticIdle.document).valid, true);
assert.equal(
  evaluateProductionReadiness(staticIdle.document).findings.some(
    (finding) => finding.code.startsWith('production.idle_')
  ),
  false
);

const animated = execute(
  staticIdle.document,
  'create-joint-motion',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'walk',
      role: 'loop',
      durationSeconds: 2,
      motions: [{
        partId: 'hinge',
        keys: [{
          phase: 0.5,
          rotationDegrees: 24
        }]
      }, {
        partId: 'ball',
        keys: [{
          phase: 0.5,
          rotationDegrees: [4, 8, 12]
        }]
      }]
    }
  }]
);
assert.equal(animated.ok, true);
if (!animated.ok) throw new Error(animated.error.message);
const walk = animated.document.animations.walk;
assert.equal(walk.name, 'animation.motion_authoring.walk');
assert.equal(walk.loop, 'loop');
assert.deepEqual(
  walk.channels[
    'animation:walk:channel:hinge:rotation'
  ].keys.map((key) => key.value),
  [
    [0, 0, 0],
    [0, 0, 24],
    [0, 0, 0]
  ]
);
assert.deepEqual(
  walk.channels[
    'animation:walk:channel:ball:rotation'
  ].keys.map((key) => key.value),
  [
    [0, 0, 0],
    [4, 8, 12],
    [0, 0, 0]
  ]
);
assert.equal(validateProjectDocument(animated.document).valid, true);

const rejected = (
  batchId: string,
  payload: CommandPayloadMap['animation.motion.upsert']
) => {
  const result = execute(
    authored.document,
    batchId,
    [{
      name: 'animation.motion.upsert',
      payload
    }]
  );
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('Expected motion rejection.');
  assert.equal(result.error.code, 'invalid_payload');
  return result.error;
};

const fixedError = rejected('reject-fixed', {
    clipId: 'fixed-motion',
    role: 'loop',
    motions: [{
      partId: 'fixed',
      keys: [{
        phase: 0.5,
        rotationDegrees: [1, 0, 0]
      }]
    }]
  });
assert.match(
  fixedError.message,
  /Fixed child part/
);
assert.equal(
  fixedError.path,
  'operations[0].payload.motions[0].partId'
);
const hingeVectorError = rejected('reject-hinge-vector', {
    clipId: 'hinge-vector',
    role: 'loop',
    motions: [{
      partId: 'hinge',
      keys: [{
        phase: 0.5,
        rotationDegrees: [0, 0, 20]
      }]
    }]
  });
assert.match(
  hingeVectorError.message,
  /one scalar angle/
);
assert.equal(
  hingeVectorError.path,
  'operations[0].payload.motions[0].keys[0].rotationDegrees'
);
assert.match(
  rejected('reject-ball-scalar', {
    clipId: 'ball-scalar',
    role: 'loop',
    motions: [{
      partId: 'ball',
      keys: [{
        phase: 0.5,
        rotationDegrees: 20
      }]
    }]
  }).message,
  /XYZ rotation vector/
);
assert.match(
  rejected('reject-empty-loop', {
    clipId: 'empty-loop',
    role: 'loop'
  }).message,
  /at least one part motion/
);
assert.match(
  rejected('reject-collapsed-phases', {
    clipId: 'collapsed',
    role: 'loop',
    motions: [{
      partId: 'hinge',
      keys: [{
        phase: 0.1,
        rotationDegrees: 5
      }, {
        phase: 0.11,
        rotationDegrees: 10
      }]
    }]
  }).message,
  /same sampled frame/
);
assert.match(
  rejected('reject-idle-role-id', {
    clipId: 'rest',
    role: 'idle'
  }).message,
  /requires clip ID "idle"/
);
assert.match(
  rejected('reject-idle-id-loop-role', {
    clipId: 'idle',
    role: 'loop',
    motions: [{
      partId: 'hinge',
      keys: [{
        phase: 0.5,
        rotationDegrees: 5
      }]
    }]
  }).message,
  /reserved for the idle role/
);
assert.match(
  rejected('reject-idle-suffix-once-role', {
    clipId: 'attack.idle',
    role: 'once',
    motions: [{
      partId: 'hinge',
      keys: [{
        phase: 0.5,
        rotationDegrees: 5
      }]
    }]
  }).message,
  /reserved for the idle role/
);
const closingError = rejected('reject-loop-closing-mismatch', {
  clipId: 'mismatched-loop',
  role: 'loop',
  motions: [{
    partId: 'hinge',
    keys: [{
      phase: 0,
      rotationDegrees: 5
    }, {
      phase: 1,
      rotationDegrees: 10
    }]
  }]
});
assert.match(closingError.message, /closing rotation/);
assert.equal(
  closingError.path,
  'operations[0].payload.motions[0].keys[1].rotationDegrees'
);
const explicitClosedLoop = execute(
  authored.document,
  'accept-matching-loop-close',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'matching-loop',
      role: 'loop',
      motions: [{
        partId: 'hinge',
        keys: [{
          phase: 0,
          rotationDegrees: 5
        }, {
          phase: 1,
          rotationDegrees: 5
        }]
      }]
    }
  }]
);
assert.equal(explicitClosedLoop.ok, true);

const triggered = structuredClone(staticIdle.document);
triggered.animations.idle = {
  ...triggered.animations.idle,
  triggers: {
    events: {
      id: 'events',
      type: 'timeline',
      keys: [{
        id: 'event-start',
        timeSeconds: 0,
        value: 'begin'
      }]
    }
  }
};
assert.equal(validateProjectDocument(triggered).valid, true);
const implicitDestruction = execute(
  triggered,
  'reject-trigger-destruction',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'idle',
      role: 'idle'
    }
  }]
);
assert.equal(implicitDestruction.ok, false);
if (implicitDestruction.ok) {
  throw new Error('Expected protected replacement rejection.');
}
assert.equal(implicitDestruction.error.code, 'invalid_state');
assert.equal(
  implicitDestruction.error.path,
  'animations.idle.triggers'
);
const explicitDestruction = execute(
  triggered,
  'explicit-trigger-destruction',
  [{
    name: 'animation.clip.delete',
    payload: { clipId: 'idle' }
  }, {
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'idle',
      role: 'idle'
    }
  }]
);
assert.equal(explicitDestruction.ok, true);
if (!explicitDestruction.ok) {
  throw new Error(explicitDestruction.error.message);
}
assert.deepEqual(
  explicitDestruction.document.animations.idle.triggers,
  {}
);

const delayed = structuredClone(staticIdle.document);
delayed.animations.idle = {
  ...delayed.animations.idle,
  startDelay: { source: 'query.delay' }
};
const advancedFieldDestruction = execute(
  delayed,
  'reject-advanced-field-destruction',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'idle',
      role: 'idle'
    }
  }]
);
assert.equal(advancedFieldDestruction.ok, false);
if (advancedFieldDestruction.ok) {
  throw new Error('Expected advanced field rejection.');
}
assert.equal(
  advancedFieldDestruction.error.path,
  'animations.idle.startDelay'
);

const budgetMotions = (
  motionCount: number,
  keyCount: number
): readonly AnimationPartMotionInput[] =>
  Array.from(
    { length: motionCount },
    (_, motionIndex): AnimationPartMotionInput => ({
      partId: `budget-part-${motionIndex}`,
      keys: Array.from(
        { length: keyCount },
        (_, keyIndex) => ({
          phase: keyIndex / Math.max(1, keyCount - 1),
          rotationDegrees: [0, 0, 0] as const
        })
      )
    })
  );

const operationBudget = execute(
  authored.document,
  'reject-operation-key-budget',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'oversized-motion',
      role: 'loop',
      motions: budgetMotions(17, 64)
    }
  }]
);
assert.equal(operationBudget.ok, false);
if (operationBudget.ok) {
  throw new Error('Expected operation budget rejection.');
}
assert.equal(operationBudget.error.code, 'invalid_payload');
assert.equal(
  operationBudget.error.path,
  'operations[0].payload.motions'
);
assert.match(operationBudget.error.message, /1024-key operation budget/);

const batchBudget = execute(
  authored.document,
  'reject-batch-key-budget',
  ['bulk-a', 'bulk-b', 'bulk-c'].map((clipId) => ({
    name: 'animation.motion.upsert' as const,
    payload: {
      clipId,
      role: 'loop' as const,
      motions: budgetMotions(11, 64)
    }
  }))
);
assert.equal(batchBudget.ok, false);
if (batchBudget.ok) {
  throw new Error('Expected batch budget rejection.');
}
assert.equal(batchBudget.error.code, 'invalid_batch');
assert.equal(batchBudget.error.path, 'operations');
assert.match(batchBudget.error.message, /2048-key batch budget/);

assert.equal(
  commandAllowedForSource(
    'animation.motion.upsert',
    'agent'
  ),
  true
);
for (const name of [
  'animation.clip.upsert',
  'animation.channels.upsert',
  'animation.triggers.upsert',
  'animation.tracks.delete',
  'animation.channels.phase',
  'animation.channels.mirror',
  'animation.clip.closeLoop'
] as const) {
  assert.equal(
    commandAllowedForSource(name, 'agent'),
    false,
    `${name} must remain a trusted compatibility command`
  );
  assert.equal(
    commandAllowedForSource(name, 'system'),
    true
  );
}
