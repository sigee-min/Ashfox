import assert from 'node:assert/strict';

import {
  validateProjectDocument
} from '@ashfox/engine-core';

import {
  createDemoHistory
} from '../src/features/workbench/demo/demoFactory';
import {
  DEFAULT_DEMO,
  DEMO_DEFINITIONS,
  resolveDemoDefinition
} from '../src/features/workbench/demo/demoRegistry';

assert.equal(DEMO_DEFINITIONS.length, 3);
assert.equal(resolveDemoDefinition(''), null);
assert.equal(
  resolveDemoDefinition('?demo=ironroot-tractor')?.slug,
  'ironroot-tractor'
);
assert.equal(resolveDemoDefinition('?demo=unknown'), null);

for (const definition of DEMO_DEFINITIONS) {
  assert.ok(
    definition.bones.length >= 100,
    `${definition.name} must expose at least 100 authored bones`
  );
  assert.ok(
    definition.cubes.length >= 100,
    `${definition.name} must expose at least 100 authored cubes`
  );
  assert.ok(
    definition.animations.length > 0,
    `${definition.name} must include animation`
  );
  assert.equal(
    new Set(definition.bones.map((bone) => bone.id)).size,
    definition.bones.length,
    `${definition.name} bone ids must be unique`
  );
  assert.equal(
    new Set(definition.cubes.map((cube) => cube.input.id)).size,
    definition.cubes.length,
    `${definition.name} cube ids must be unique`
  );

  const history = createDemoHistory(definition);
  assert.equal(
    validateProjectDocument(history.present).valid,
    true,
    `${definition.name} must produce a valid canonical project`
  );
  assert.equal(
    history.present.formatProfile.id,
    'minecraft.java.geckolib5'
  );
  assert.equal(
    Object.keys(history.present.animations).length,
    definition.animations.length
  );
}
