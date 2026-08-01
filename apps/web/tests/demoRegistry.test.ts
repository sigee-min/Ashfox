import assert from 'node:assert/strict';
import validator from 'gltf-validator';

import {
  evaluateProductionReadiness,
  executeCommandBatch,
  exportProductionProject,
  exportProductionProjectResolved,
  readPartRecipe,
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

assert.equal(DEMO_DEFINITIONS.length, 8);
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
  target: 'bedrock' | 'glb' | 'geckolib5',
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
  meshes?: ReadonlyArray<{ primitives: readonly unknown[] }>;
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
  const recipe = readPartRecipe(history.present);
  assert.equal(recipe.ok, true);
  if (!recipe.ok) {
    throw new Error(`${definition.name} semantic recipe is unreadable.`);
  }
  assert.equal(
    recipe.recipe?.parts.filter(
      (part) => part.kind === 'feature' && part.motif === 'eye'
    ).length ?? 0,
    definition.visibleEyeCount,
    `${definition.name} must use one semantic feature per visible eye`
  );
  assert.equal(
    definition.cubes.some((cube) =>
      /(?:^|[._-])(?:eye|eyes|eyeball|iris|pupil|glint)(?:$|[._-])/i.test(
        cube.input.id
      )
    ),
    false,
    `${definition.name} must not reconstruct eyes from stacked cubes`
  );
  if (definition.slug === 'aether-spear-rocket') {
    const bedrockProject = targetProject(
      history.present,
      'bedrock',
      'demo-aether-spear-target-bedrock-budget'
    );
    for (const bundle of [
      exportProductionProject(history.present),
      exportProductionProject(bedrockProject)
    ]) {
      const jsonBytes = bundle.files.reduce(
        (sum, file) => sum + (
          file.kind === 'json'
            ? new TextEncoder().encode(file.text).byteLength
            : 0
        ),
        0
      );
      assert.ok(
        jsonBytes < 70_000,
        `${bundle.target.id} Aether JSON must remain below its 70 KB budget`
      );
    }
  }

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
    const gltf = glbJson(model.data);
    assert.equal(
      gltf.animations?.length,
      definition.animations.length,
      `${definition.name} must preserve every numeric animation clip in GLB`
    );
    if (definition.slug === 'aether-spear-rocket') {
      assert.equal(
        gltf.meshes?.reduce(
          (count, mesh) => count + mesh.primitives.length,
          0
        ),
        1,
        'Aether Spear GLB must remain one base-pass primitive'
      );
      assert.ok(
        model.data.byteLength < 100_000,
        'Aether Spear optimized GLB must remain below its 100 KB budget'
      );
    }
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
    assert.equal(
      report.issues.numErrors,
      0,
      `${definition.name} GLB errors: ${JSON.stringify(report.issues.messages)}`
    );
    assert.equal(
      report.issues.numWarnings,
      0,
      `${definition.name} GLB warnings: ${JSON.stringify(report.issues.messages)}`
    );
  })());
}

export const test = Promise.all(exportChecks).then(() => undefined);
