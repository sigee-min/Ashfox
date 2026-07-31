import assert from 'node:assert/strict';
import validator from 'gltf-validator';

import {
  evaluateProductionReadiness,
  executeCommandBatch,
  exportProductionProjectResolved,
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

const validationPng = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  )
);

const targetProject = (
  document: ReturnType<typeof createDemoHistory>['present'],
  target: 'glb' | 'geckolib5',
  batchId: string
) => {
  const result = executeCommandBatch(document, {
    batchId,
    baseProjectId: document.id,
    baseRevision: document.revision,
    operations: [{
      name: 'project.target.set',
      payload: { target }
    }]
  }, { source: 'agent' });
  if (!result.ok) throw new Error(result.error.message);
  return result.document;
};

const glbJson = (bytes: Uint8Array): {
  animations?: readonly unknown[];
} => {
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  );
  const jsonLength = view.getUint32(12, true);
  return JSON.parse(
    new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)).trimEnd()
  ) as { animations?: readonly unknown[] };
};

const exportChecks: Promise<void>[] = [];

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

  const authoredScene = structuredClone(history.present.scene);
  const authoredAnimations = structuredClone(history.present.animations);
  const glbProject = targetProject(
    history.present,
    'glb',
    `demo-${definition.slug}-target-glb`
  );
  assert.deepEqual(glbProject.scene, authoredScene);
  assert.deepEqual(glbProject.animations, authoredAnimations);
  assert.equal(
    evaluateProductionReadiness(glbProject).mechanicallyReady,
    true,
    `${definition.name} must remain production ready for GLB delivery`
  );

  const restored = targetProject(
    glbProject,
    'geckolib5',
    `demo-${definition.slug}-restore-geckolib`
  );
  assert.deepEqual(restored.scene, authoredScene);
  assert.deepEqual(restored.animations, authoredAnimations);

  exportChecks.push((async () => {
    const bundle = await exportProductionProjectResolved(glbProject, {
      resolveBlob: async () => ({
        bytes: validationPng,
        contentType: 'image/png'
      })
    });
    assert.equal(bundle.files.length, 1);
    const model = bundle.files[0];
    if (model?.kind !== 'binary') {
      throw new Error(`${definition.name} GLB artifact is missing.`);
    }
    assert.equal(
      glbJson(model.data).animations?.length,
      definition.animations.length,
      `${definition.name} must preserve every numeric animation clip in GLB`
    );
    const triggerIds = Object.values(authoredAnimations).flatMap((clip) =>
      Object.values(clip.triggers)
        .filter((track) => track.keys.length > 0)
        .map((track) => track.id)
    );
    assert.deepEqual(
      bundle.adaptations.omitted
        .map((item) => item.triggerId)
        .filter((id): id is string => id !== undefined)
        .sort(),
      [...triggerIds].sort(),
      `${definition.name} must receipt every target-only trigger omission`
    );
    const report = await validator.validateBytes(model.data, {
      uri: `${definition.slug}.glb`,
      format: 'glb'
    });
    assert.equal(report.issues.numErrors, 0);
    assert.equal(report.issues.numWarnings, 0);
  })());
}

export const test = Promise.all(exportChecks).then(() => undefined);
