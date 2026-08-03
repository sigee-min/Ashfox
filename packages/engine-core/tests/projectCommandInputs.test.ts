import assert from 'node:assert/strict';

import {
  createProjectFromInput,
  executeCommandBatch,
  type CommandBatch,
  type ProjectDocument
} from '../src';

const base = createProjectFromInput(
  {
    id: 'project-command-input-base',
    name: 'Command input base',
    target: 'glb',
    namespace: 'ashfox',
    modelPath: 'command_input_base',
    createdAt: '2026-07-31T00:00:00.000Z'
  },
  'local-0001'
);

const execute = (
  document: ProjectDocument,
  batchId: string,
  operations: CommandBatch['operations']
) =>
  executeCommandBatch(
    document,
    {
      batchId,
      baseProjectId: document.id,
      baseRevision: document.revision,
      operations
    },
    { source: 'agent' }
  );

const created = execute(base, 'minimal-project-create', [{
  name: 'project.create',
  payload: {
    name: 'Golden Truck',
    target: 'geckolib5',
    density: 1
  }
}]);
assert.equal(created.ok, true);
if (!created.ok) throw new Error(created.error.message);
assert.match(
  created.document.id,
  /^project-golden_truck-[0-9a-z]+$/
);
assert.equal(created.document.name, 'Golden Truck');
assert.equal(created.document.createdAt, base.updatedAt);
assert.equal(created.document.settings.surfacePixelDensity, 1);
assert.equal(
  created.document.formatProfile.id,
  'minecraft.java.geckolib5'
);
assert.deepEqual(
  created.document.animations,
  {},
  'creating a Gecko project must not inject a placeholder animation'
);
if (
  created.document.formatProfile.id !==
  'minecraft.java.geckolib5'
) {
  throw new Error('Expected GeckoLib project.');
}
assert.equal(created.document.formatProfile.namespace, 'ashfox');
assert.equal(created.document.formatProfile.modelPath, 'golden_truck');

const repeated = execute(base, 'repeat-minimal-project-create', [{
  name: 'project.create',
  payload: {
    name: 'Golden Truck',
    target: 'geckolib5',
    density: 1
  }
}]);
assert.equal(repeated.ok, true);
if (!repeated.ok) throw new Error(repeated.error.message);
assert.equal(
  repeated.document.id,
  created.document.id,
  'project identity derivation must be deterministic'
);

const intent = execute(
  created.document,
  'minimal-project-intent',
  [{
    name: 'project.intent.set',
    payload: {
      subject: 'Golden utility truck'
    }
  }]
);
assert.equal(intent.ok, true);
if (!intent.ok) throw new Error(intent.error.message);
assert.deepEqual(intent.document.intent, {
  subject: 'Golden utility truck',
  forward: 'north',
  grounding: 'free',
  features: []
});

const explicitIntent = execute(
  intent.document,
  'explicit-project-intent',
  [{
    name: 'project.intent.set',
    payload: {
      subject: 'Golden utility truck',
      grounding: 'grounded',
      features: ['Connected body']
    }
  }]
);
assert.equal(explicitIntent.ok, true);
if (!explicitIntent.ok) {
  throw new Error(explicitIntent.error.message);
}
const renamedIntent = execute(
  explicitIntent.document,
  'rename-project-intent-subject',
  [{
    name: 'project.intent.set',
    payload: {
      subject: 'Golden cargo truck'
    }
  }]
);
assert.equal(renamedIntent.ok, true);
if (!renamedIntent.ok) {
  throw new Error(renamedIntent.error.message);
}
assert.equal(renamedIntent.document.intent?.grounding, 'free');
assert.deepEqual(
  renamedIntent.document.intent?.features,
  [],
  'setting a new subject must replace the complete planning contract'
);

const target = execute(
  intent.document,
  'minimal-target-change',
  [{
    name: 'project.target.set',
    payload: {
      target: 'glb'
    }
  }]
);
assert.equal(target.ok, true);
if (!target.ok) throw new Error(target.error.message);
assert.equal(target.document.formatProfile.id, 'gltf.2');
if (target.document.formatProfile.id !== 'gltf.2') {
  throw new Error('Expected glTF profile.');
}
assert.equal(target.document.formatProfile.container, 'glb');
assert.equal(target.document.formatProfile.modelPath, 'golden_truck');

const invalidTarget = execute(
  intent.document,
  'invalid-target-input',
  [{
    name: 'project.target.set',
    payload: {
      target: 'bedrock',
      unexpected: true
    }
  } as unknown as CommandBatch['operations'][number]]
);
assert.equal(invalidTarget.ok, false);
if (!invalidTarget.ok) {
  assert.equal(invalidTarget.error.code, 'invalid_payload');
  assert.equal(
    invalidTarget.error.path,
    'operations[0].payload.unexpected'
  );
}
