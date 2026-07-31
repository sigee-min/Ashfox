import assert from 'node:assert/strict';

import {
  commandAllowedForSource,
  createProjectFromInput,
  evaluateProductionReadiness,
  executeCommandBatch,
  getAgentCommandDefinition,
  validateProjectDocument,
  type CommandBatch,
  type ProjectDocument
} from '../src';

const root = {
  kind: 'plate' as const,
  partId: 'body',
  parentPartId: null,
  materialId: 'gold',
  joint: { kind: 'fixed' as const },
  plane: 'xy' as const,
  origin: [-2, 0, 0] as const,
  outline: [[0, 0], [4, 0], [4, 4], [0, 4]] as const,
  thickness: 4
};

const child = (
  partId: string,
  center: readonly [number, number, number],
  joint:
    | { readonly kind: 'fixed' }
    | {
        readonly kind: 'hinge';
        readonly axis: 'x' | 'y' | 'z';
      }
    | { readonly kind: 'ball' }
) => ({
  kind: 'mass' as const,
  partId,
  parentPartId: 'body',
  materialId: 'gold',
  joint,
  center,
  radii: [1, 1, 1] as const,
  profile: 'hard' as const
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
const authored = execute(base, 'author-rig', [{
  name: 'model.parts.upsert',
  payload: {
    parts: [root, hinge, ball, fixed],
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
      role: 'idle',
      durationFrames: 20,
      static: true
    }
  }]
);
assert.equal(staticIdle.ok, true);
if (!staticIdle.ok) throw new Error(staticIdle.error.message);
const idle = staticIdle.document.animations.idle;
assert.equal(idle.name, 'animation.motion_authoring.idle');
assert.equal(idle.durationSeconds, 1);
assert.equal(idle.fps, 20);
assert.equal(idle.loop, 'loop');
assert.deepEqual(Object.keys(idle.channels), [
  'animation:idle:channel:body:rotation'
]);
assert.deepEqual(
  Object.values(idle.channels)[0].keys.map(
    (key) => [key.timeSeconds, key.value]
  ),
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

const inheritedWinding = structuredClone(staticIdle.document);
const windingRoot = inheritedWinding.animations.idle.channels[
  'animation:idle:channel:body:rotation'
];
inheritedWinding.animations.idle.channels = {
  ...inheritedWinding.animations.idle.channels,
  [windingRoot.id]: {
    ...windingRoot,
    keys: windingRoot.keys.map((key, index) =>
      index === windingRoot.keys.length - 1
        ? { ...key, value: [0, 0, 360] }
        : key
    )
  }
};
const inheritedIdleWinding = execute(
  inheritedWinding,
  'reject-inherited-idle-winding',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'idle',
      poses: [{ rotations: { hinge: -4 } }, {
        rotations: { hinge: 4 }
      }]
    }
  }]
);
assert.equal(inheritedIdleWinding.ok, false);
if (!inheritedIdleWinding.ok) {
  assert.match(
    inheritedIdleWinding.error.message,
    /canonical idle must be a numerically closed loop/
  );
}

const legacyIdleDocument = structuredClone(staticIdle.document);
const legacyIdleClip = legacyIdleDocument.animations.idle;
legacyIdleDocument.animations = {
  legacy_idle: {
    ...legacyIdleClip,
    id: 'legacy_idle'
  }
};
const recoveredCanonicalIdle = execute(
  legacyIdleDocument,
  'recover-canonical-idle',
  [{
    name: 'animation.clip.delete',
    payload: { clipId: 'legacy_idle' }
  }, {
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'idle',
      role: 'idle',
      durationFrames: 20,
      static: true
    }
  }]
);
assert.equal(recoveredCanonicalIdle.ok, true);
if (!recoveredCanonicalIdle.ok) {
  throw new Error(recoveredCanonicalIdle.error.message);
}
assert.deepEqual(
  Object.keys(recoveredCanonicalIdle.document.animations),
  ['idle']
);

const animated = execute(
  staticIdle.document,
  'create-joint-motion',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'walk',
      role: 'loop',
      durationFrames: 40,
      poses: [{
        rotations: {
          hinge: -24,
          ball: [-4, -8, -12]
        }
      }, {
        rotations: {
          hinge: 24,
          ball: [4, 8, 12]
        }
      }]
    }
  }]
);
assert.equal(animated.ok, true);
if (!animated.ok) throw new Error(animated.error.message);
const walk = animated.document.animations.walk;
assert.equal(walk.durationSeconds, 2);
assert.equal(walk.loop, 'loop');
assert.deepEqual(
  walk.channels[
    'animation:walk:channel:hinge:rotation'
  ].keys.map((key) => [key.timeSeconds, key.value]),
  [
    [0, [0, 0, -24]],
    [1, [0, 0, 24]],
    [2, [0, 0, -24]]
  ]
);
assert.deepEqual(
  walk.channels[
    'animation:walk:channel:ball:rotation'
  ].keys.map((key) => key.value),
  [
    [-4, -8, -12],
    [4, 8, 12],
    [-4, -8, -12]
  ]
);

const preservedBall = structuredClone(
  walk.channels[
    'animation:walk:channel:ball:rotation'
  ]
);
const patched = execute(
  animated.document,
  'patch-one-part',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'walk',
      poses: [{
        rotations: { hinge: -12 }
      }, {
        rotations: { hinge: 12 }
      }]
    }
  }]
);
assert.equal(patched.ok, true);
if (!patched.ok) throw new Error(patched.error.message);
assert.equal(patched.summary, 'Patch motion walk');
assert.equal(patched.document.animations.walk.name, walk.name);
assert.equal(patched.document.animations.walk.loop, walk.loop);
assert.equal(
  patched.document.animations.walk.durationSeconds,
  walk.durationSeconds
);
assert.equal(patched.document.animations.walk.fps, walk.fps);
assert.deepEqual(
  patched.document.animations.walk.channels[
    'animation:walk:channel:ball:rotation'
  ],
  preservedBall
);

const openExistingLoop = structuredClone(animated.document);
const openBall = openExistingLoop.animations.walk.channels[
  'animation:walk:channel:ball:rotation'
];
openExistingLoop.animations.walk.channels = {
  ...openExistingLoop.animations.walk.channels,
  [openBall.id]: {
    ...openBall,
    keys: openBall.keys.map((key, index) =>
      index === openBall.keys.length - 1
        ? { ...key, value: [8, 8, 8] }
        : key
    )
  }
};
const unrelatedOpenLoopPatch = execute(
  openExistingLoop,
  'reject-unrelated-open-loop-patch',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'walk',
      poses: [{ rotations: { hinge: -10 } }, {
        rotations: { hinge: 10 }
      }]
    }
  }]
);
assert.equal(unrelatedOpenLoopPatch.ok, false);
if (!unrelatedOpenLoopPatch.ok) {
  assert.match(
    unrelatedOpenLoopPatch.error.message,
    /preserves an open rotation track/
  );
}

const nonCanonicalFps = structuredClone(patched.document);
nonCanonicalFps.animations.walk = {
  ...nonCanonicalFps.animations.walk,
  fps: 30
};
const implicitMixedFps = execute(
  nonCanonicalFps,
  'reject-implicit-mixed-fps',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'walk',
      poses: [{ rotations: { hinge: -8 } }, {
        rotations: { hinge: 8 }
      }]
    }
  }]
);
assert.equal(implicitMixedFps.ok, false);
if (!implicitMixedFps.ok) {
  assert.equal(
    implicitMixedFps.error.path,
    'animations.walk.fps'
  );
}
const explicitCanonicalRetime = execute(
  nonCanonicalFps,
  'explicit-canonical-retime',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'walk',
      durationFrames: 40,
      poses: [{ rotations: { hinge: -8 } }, {
        rotations: { hinge: 8 }
      }]
    }
  }]
);
assert.equal(explicitCanonicalRetime.ok, true);
if (!explicitCanonicalRetime.ok) {
  throw new Error(explicitCanonicalRetime.error.message);
}
assert.equal(
  explicitCanonicalRetime.document.animations.walk.fps,
  20
);
assert.equal(
  explicitCanonicalRetime.document.animations.walk.loop,
  walk.loop
);
const offGridChannelDocument = structuredClone(nonCanonicalFps);
const offGridBall = offGridChannelDocument.animations.walk.channels[
  'animation:walk:channel:ball:rotation'
];
offGridChannelDocument.animations.walk.channels = {
  ...offGridChannelDocument.animations.walk.channels,
  [offGridBall.id]: {
    ...offGridBall,
    keys: offGridBall.keys.map((key, index) =>
      index === 1
        ? { ...key, timeSeconds: 1 / 30 }
        : key
    )
  }
};
const offGridChannelRetime = execute(
  offGridChannelDocument,
  'reject-off-grid-channel-retime',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'walk',
      durationFrames: 40,
      poses: [{ rotations: { hinge: -8 } }, {
        rotations: { hinge: 8 }
      }]
    }
  }]
);
assert.equal(offGridChannelRetime.ok, false);
if (!offGridChannelRetime.ok) {
  assert.equal(
    offGridChannelRetime.error.path,
    'animations.walk.channels.animation:walk:channel:ball:rotation.keys[1].timeSeconds'
  );
}

const removed = execute(
  patched.document,
  'remove-one-part-track',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'walk',
      role: 'loop',
      durationFrames: 40,
      removePartIds: ['ball']
    }
  }]
);
assert.equal(removed.ok, true);
if (!removed.ok) throw new Error(removed.error.message);
assert.equal(
  removed.document.animations.walk.channels[
    'animation:walk:channel:ball:rotation'
  ],
  undefined
);
assert.ok(
  removed.effects.removedEntityIds.includes(
    'animation:walk:channel:ball:rotation'
  )
);

const missingTrackRemoval = execute(
  patched.document,
  'remove-missing-part-track',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'walk',
      role: 'loop',
      durationFrames: 40,
      removePartIds: ['fixed']
    }
  }]
);
assert.equal(missingTrackRemoval.ok, false);
if (!missingTrackRemoval.ok) {
  assert.equal(
    missingTrackRemoval.error.path,
    'operations[0].payload.removePartIds[0]'
  );
}

const onceWalk = execute(
  patched.document,
  'change-motion-role',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'walk',
      role: 'once',
      durationFrames: 40
    }
  }]
);
assert.equal(onceWalk.ok, true);
if (!onceWalk.ok) throw new Error(onceWalk.error.message);
assert.equal(onceWalk.document.animations.walk.loop, 'once');
assert.deepEqual(
  onceWalk.document.animations.walk.channels,
  patched.document.animations.walk.channels,
  'changing clip role must preserve every omitted track'
);

const once = execute(
  authored.document,
  'single-pose-once',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'strike',
      role: 'once',
      durationFrames: 10,
      poses: [{
        rotations: { hinge: 45 }
      }]
    }
  }]
);
assert.equal(once.ok, true);
if (!once.ok) throw new Error(once.error.message);
assert.deepEqual(
  once.document.animations.strike.channels[
    'animation:strike:channel:hinge:rotation'
  ].keys.map((key) => [key.timeSeconds, key.value]),
  [
    [0, [0, 0, 0]],
    [0.5, [0, 0, 45]]
  ]
);

const openOnceToLoop = execute(
  once.document,
  'reject-open-once-to-loop',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'strike',
      role: 'loop',
      durationFrames: 10
    }
  }]
);
assert.equal(openOnceToLoop.ok, false);
if (!openOnceToLoop.ok) {
  assert.equal(
    openOnceToLoop.error.path,
    'operations[0].payload.role'
  );
}

const heldStrike = execute(
  once.document,
  'hold-open-strike',
  [{
    name: 'animation.clip.upsert',
    payload: {
      id: 'strike',
      name: once.document.animations.strike.name,
      durationSeconds: 0.5,
      fps: 20,
      loop: 'hold_on_last_frame'
    }
  }],
  'system'
);
assert.equal(heldStrike.ok, true);
if (!heldStrike.ok) {
  throw new Error(heldStrike.error.message);
}
const heldToLoop = execute(
  heldStrike.document,
  'reject-held-to-loop',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'strike',
      role: 'loop',
      durationFrames: 10
    }
  }]
);
assert.equal(heldToLoop.ok, false);
if (!heldToLoop.ok) {
  assert.equal(
    heldToLoop.error.path,
    'operations[0].payload.role'
  );
}

const onceWithOpenPosition = execute(
  once.document,
  'add-open-position-track',
  [{
    name: 'animation.channels.upsert',
    payload: {
      clipId: 'strike',
      channels: [{
        id: 'animation:strike:channel:hinge:position',
        targetNodeId: 'bone:body',
        property: 'position',
        keys: [
          {
            id: 'animation:strike:key:hinge:position:0',
            timeSeconds: 0,
            value: [0, 0, 0]
          },
          {
            id: 'animation:strike:key:hinge:position:10',
            timeSeconds: 0.5,
            value: [1, 0, 0]
          }
        ]
      }]
    }
  }],
  'system'
);
if (!onceWithOpenPosition.ok) {
  throw new Error(JSON.stringify(onceWithOpenPosition.error));
}
assert.equal(onceWithOpenPosition.ok, true);
const openPositionToLoop = execute(
  onceWithOpenPosition.document,
  'reject-open-position-to-loop',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'strike',
      role: 'loop',
      durationFrames: 10,
      poses: [
        { rotations: { hinge: 0 } },
        { rotations: { hinge: 45 } }
      ]
    }
  }]
);
assert.equal(openPositionToLoop.ok, false);
if (!openPositionToLoop.ok) {
  assert.equal(
    openPositionToLoop.error.path,
    'operations[0].payload.role'
  );
  assert.match(
    openPositionToLoop.error.message,
    /open position track/
  );
}

const spin = execute(
  authored.document,
  'continuous-spin',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'wheel',
      role: 'loop',
      durationFrames: 20,
      spins: [{
        partId: 'hinge',
        turns: 1,
        direction: 'negative'
      }]
    }
  }]
);
assert.equal(spin.ok, true);
if (!spin.ok) throw new Error(spin.error.message);
const spinKeys = spin.document.animations.wheel.channels[
  'animation:wheel:channel:hinge:rotation'
].keys;
assert.equal(spinKeys.length, 21);
assert.deepEqual(spinKeys[0].value, [0, 0, 0]);
assert.deepEqual(spinKeys.at(-1)?.value, [0, 0, -360]);
assert.equal(spinKeys[1].timeSeconds, 0.05);

const shortest = execute(
  authored.document,
  'shortest-path',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'look',
      role: 'loop',
      durationFrames: 20,
      poses: [{
        rotations: { hinge: 170 }
      }, {
        rotations: { hinge: -170 }
      }]
    }
  }]
);
assert.equal(shortest.ok, true);
if (!shortest.ok) throw new Error(shortest.error.message);
assert.deepEqual(
  shortest.document.animations.look.channels[
    'animation:look:channel:hinge:rotation'
  ].keys.map((key) => key.value[2]),
  [170, 190, 170]
);

const unilateralBase = createProjectFromInput(
  {
    id: 'animation-motion-unilateral',
    name: 'Animation motion unilateral',
    target: 'geckolib5',
    namespace: 'ashfox',
    modelPath: 'motion_unilateral',
    createdAt: '2026-07-31T00:00:00.000Z'
  },
  'motion-unilateral-0001'
);
const unilateralRig = execute(
  unilateralBase,
  'author-unilateral-rig',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [
        root,
        child(
          'left_wing',
          [-3, 2, 1],
          { kind: 'hinge', axis: 'z' }
        ),
        child(
          'right_wing',
          [3, 2, 1],
          { kind: 'hinge', axis: 'z' }
        )
      ],
      materials: [{
        id: 'gold',
        baseColor: '#C58A32'
      }]
    }
  }]
);
assert.equal(unilateralRig.ok, true);
if (!unilateralRig.ok) {
  throw new Error(unilateralRig.error.message);
}
const unilateralMotion = execute(
  unilateralRig.document,
  'author-unilateral-motion',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'flap',
      role: 'loop',
      durationFrames: 20,
      poses: [{
        rotations: { left_wing: -20 }
      }, {
        rotations: { left_wing: 20 }
      }]
    }
  }]
);
assert.equal(unilateralMotion.ok, true);
if (!unilateralMotion.ok) {
  throw new Error(unilateralMotion.error.message);
}
assert.equal(
  unilateralMotion.document.animations.flap.channels[
    'animation:flap:channel:right_wing:rotation'
  ],
  undefined,
  'omitted counterpart tracks must never be invented'
);

const rejected = (
  batchId: string,
  payload: Record<string, unknown>
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
  return result.error;
};

assert.equal(
  rejected('reject-new-clip-without-role', {
    clipId: 'missing-role',
    durationFrames: 20,
    poses: [{ rotations: { hinge: -5 } }, {
      rotations: { hinge: 5 }
    }]
  }).path,
  'operations[0].payload.role'
);
assert.equal(
  rejected('reject-new-clip-without-duration', {
    clipId: 'missing-duration',
    role: 'loop',
    poses: [{ rotations: { hinge: -5 } }, {
      rotations: { hinge: 5 }
    }]
  }).path,
  'operations[0].payload.durationFrames'
);
assert.match(
  rejected('reject-late-first-pose', {
    clipId: 'late-part',
    role: 'loop',
    durationFrames: 20,
    poses: [{
      rotations: { hinge: -10 }
    }, {
      rotations: {
        hinge: 10,
        ball: [2, 4, 6]
      }
    }]
  }).message,
  /first appears after the opening pose/
);

assert.match(
  rejected('reject-unexpected-payload', {
    clipId: 'unexpected',
    role: 'loop',
    durationFrames: 20,
    poses: [{
      rotations: { left_wing: 20 }
    }, {
      rotations: { left_wing: -20 }
    }],
    unexpected: true
  }).message,
  /not part of this command/
);
assert.match(
  rejected('reject-fixed', {
    clipId: 'fixed-motion',
    role: 'loop',
    durationFrames: 20,
    poses: [{
      rotations: { fixed: [1, 0, 0] }
    }, {
      rotations: { fixed: [-1, 0, 0] }
    }]
  }).message,
  /Fixed child part/
);
assert.match(
  rejected('reject-hinge-vector', {
    clipId: 'hinge-vector',
    role: 'loop',
    durationFrames: 20,
    poses: [{
      rotations: { hinge: [0, 0, 20] }
    }]
  }).message,
  /one scalar angle/
);
assert.match(
  rejected('reject-ball-scalar', {
    clipId: 'ball-scalar',
    role: 'loop',
    durationFrames: 20,
    poses: [{
      rotations: { ball: 20 }
    }]
  }).message,
  /XYZ rotation vector/
);
assert.match(
  rejected('reject-unacknowledged-static-idle', {
    clipId: 'idle',
    role: 'idle',
    durationFrames: 20,
    poses: [{
      rotations: { hinge: 0 }
    }]
  }).message,
  /distinct poses/
);
assert.match(
  rejected('reject-static-loop', {
    clipId: 'static-loop',
    role: 'loop',
    durationFrames: 20,
    static: true
  }).message,
  /Only the canonical idle/
);
assert.match(
  rejected('reject-full-winding-as-poses', {
    clipId: 'winding',
    role: 'loop',
    durationFrames: 20,
    poses: [{
      rotations: { hinge: 0 }
    }, {
      rotations: { hinge: 120 }
    }, {
      rotations: { hinge: 240 }
    }]
  }).message,
  /full winding/
);
assert.match(
  rejected('reject-fractional-loop-spin', {
    clipId: 'fractional-spin',
    role: 'loop',
    durationFrames: 20,
    spins: [{
      partId: 'hinge',
      turns: 0.5
    }]
  }).message,
  /whole turns/
);
assert.match(
  rejected('reject-idle-role-id', {
    clipId: 'rest',
    role: 'idle',
    durationFrames: 20,
    static: true
  }).message,
  /requires clip ID "idle"/
);
assert.match(
  rejected('reject-idle-id-loop-role', {
    clipId: 'idle',
    role: 'loop',
    durationFrames: 20,
    poses: [{
      rotations: { hinge: -5 }
    }, {
      rotations: { hinge: 5 }
    }]
  }).message,
  /reserved for the idle role/
);

const triggered = structuredClone(staticIdle.document);
triggered.animations.idle = {
  ...triggered.animations.idle,
  triggers: {
    events: {
      id: 'events',
      type: 'timeline',
      keys: [{
        id: 'event-start',
        timeSeconds: 0.5,
        value: 'begin'
      }]
    }
  },
  startDelay: {
    kind: 'molang',
    source: 'query.anim_time'
  }
};
const preservedTimingPatch = execute(
  triggered,
  'preserve-omitted-timing',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'idle',
      static: true
    }
  }]
);
assert.equal(preservedTimingPatch.ok, true);
if (!preservedTimingPatch.ok) {
  throw new Error(preservedTimingPatch.error.message);
}
assert.equal(
  preservedTimingPatch.document.animations.idle.durationSeconds,
  triggered.animations.idle.durationSeconds
);
assert.equal(
  preservedTimingPatch.document.animations.idle.fps,
  triggered.animations.idle.fps
);
assert.equal(
  preservedTimingPatch.document.animations.idle.loop,
  triggered.animations.idle.loop
);
assert.equal(
  preservedTimingPatch.document.animations.idle.name,
  triggered.animations.idle.name
);
assert.deepEqual(
  preservedTimingPatch.document.animations.idle.triggers,
  triggered.animations.idle.triggers
);
const offGridTrigger = structuredClone(triggered);
offGridTrigger.animations.idle.triggers.events = {
  ...offGridTrigger.animations.idle.triggers.events,
  keys: offGridTrigger.animations.idle.triggers.events.keys.map(
    (key) => ({ ...key, timeSeconds: 0.53 })
  )
};
const offGridTriggerRetime = execute(
  offGridTrigger,
  'reject-off-grid-trigger-retime',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'idle',
      durationFrames: 40,
      static: true
    }
  }]
);
assert.equal(offGridTriggerRetime.ok, false);
if (!offGridTriggerRetime.ok) {
  assert.equal(
    offGridTriggerRetime.error.path,
    'animations.idle.triggers.events.keys[0].timeSeconds'
  );
}
const safePatch = execute(
  triggered,
  'preserve-advanced-fields',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'idle',
      role: 'idle',
      durationFrames: 40,
      static: true
    }
  }]
);
if (!safePatch.ok) {
  throw new Error(JSON.stringify(safePatch.error));
}
assert.deepEqual(
  safePatch.document.animations.idle.startDelay,
  {
    kind: 'molang',
    source: 'query.anim_time'
  }
);
assert.equal(
  safePatch.document.animations.idle.triggers.events
    .keys[0].timeSeconds,
  1
);

const operationBudget = execute(
  authored.document,
  'reject-operation-key-budget',
  [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'oversized-spin',
      role: 'loop',
      durationFrames: 1_024,
      spins: [{
        partId: 'hinge',
        turns: 1
      }]
    }
  }]
);
assert.equal(operationBudget.ok, false);
if (operationBudget.ok) {
  throw new Error('Expected operation budget rejection.');
}
assert.equal(operationBudget.error.code, 'invalid_payload');
assert.match(operationBudget.error.message, /1024-key operation budget/);

const batchBudget = execute(
  authored.document,
  'reject-batch-key-budget',
  ['bulk-a', 'bulk-b', 'bulk-c'].map((clipId) => ({
    name: 'animation.motion.upsert' as const,
    payload: {
      clipId,
      role: 'loop' as const,
      durationFrames: 700,
      spins: [{
        partId: 'hinge',
        turns: 1
      }]
    }
  }))
);
assert.equal(batchBudget.ok, false);
if (batchBudget.ok) {
  throw new Error('Expected batch budget rejection.');
}
assert.equal(batchBudget.error.code, 'invalid_batch');
assert.match(batchBudget.error.message, /2048-key batch budget/);

const motionSchema = getAgentCommandDefinition(
  'animation.motion.upsert'
)?.inputSchema as {
  required: readonly string[];
  properties: {
    role: { description: string };
    durationFrames: { description: string };
    poses: { description: string };
  };
};
assert.deepEqual(motionSchema.required, ['clipId']);
assert.match(motionSchema.properties.role.description, /new clip/);
assert.match(
  motionSchema.properties.durationFrames.description,
  /retimes the whole clip/
);
assert.match(
  motionSchema.properties.poses.description,
  /must appear in the first pose/
);

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
    `${name} must remain outside the agent command surface`
  );
}
