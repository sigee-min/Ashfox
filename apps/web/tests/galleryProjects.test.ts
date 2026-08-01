import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import validator from 'gltf-validator';

import {
  auditEyeAnatomy,
  auditEyeVisibility,
  evaluateProductionReadiness,
  executeCommandBatch,
  exportProductionProjectResolved,
  readPartRecipe,
  validateProjectDocument,
  type PartSpec,
  type ProjectDocument,
  type Vec3
} from '@ashfox/engine-core';

import {
  readProjectArchive
} from '../src/features/files/projectArchive';

const repositoryRoot = path.resolve(__dirname, '../../..');
const galleryRoot = path.join(repositoryRoot, 'examples', 'gallery');

const projectForGlb = (
  document: ProjectDocument,
  demoId: string
): ProjectDocument => {
  if (
    document.formatProfile.id === 'gltf.2' &&
    document.formatProfile.container === 'glb'
  ) return document;
  const result = executeCommandBatch(document, {
    batchId: `gallery-${demoId}-validate-glb`,
    baseProjectId: document.id,
    baseRevision: document.revision,
    operations: [{
      name: 'project.target.set',
      payload: { target: 'glb' }
    }]
  }, { source: 'system' });
  if (!result.ok) throw new Error(result.error.message);
  return result.document;
};

const glbJson = (bytes: Uint8Array): {
  accessors: ReadonlyArray<{ count: number }>;
  animations?: readonly unknown[];
  meshes?: ReadonlyArray<{
    primitives: ReadonlyArray<{ indices: number }>;
  }>;
} => {
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  );
  const jsonLength = view.getUint32(12, true);
  return JSON.parse(
    new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)).trimEnd()
  ) as ReturnType<typeof glbJson>;
};

const partTerminalPoint = (part: PartSpec): Vec3 | null => {
  if (part.kind === 'mass') return part.center;
  if (part.kind === 'segment') return part.points.at(-1) ?? null;
  if (part.kind === 'feature') return part.anchor;
  return null;
};

const forwardDistance = (
  point: Vec3,
  direction: NonNullable<ProjectDocument['intent']>['forward']
): number => {
  switch (direction) {
    case 'north': return -point[2];
    case 'south': return point[2];
    case 'east': return point[0];
    case 'west': return -point[0];
  }
};

export const test = (async (): Promise<void> => {
  const directories = (await readdir(galleryRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  assert.ok(directories.length > 0, 'gallery must contain demo folders');

  for (const directory of directories) {
    const demoRoot = path.join(galleryRoot, directory);
    const manifest = JSON.parse(
      await readFile(path.join(demoRoot, 'demo.json'), 'utf8')
    ) as {
      id: string;
      name: string;
      project: string;
      metrics: {
        bones: number;
        cubes: number;
        animations: number;
        triangles: number;
        glbPrimitives: number;
        semanticEyes: number;
      };
    };
    assert.equal(manifest.id, directory);
    const bytes = new Uint8Array(
      await readFile(path.join(demoRoot, manifest.project))
    );
    const archive = await readProjectArchive(bytes);
    const nodes = Object.values(archive.document.scene.nodes);
    assert.equal(
      validateProjectDocument(archive.document).valid,
      true,
      `${manifest.id} finished archive must be valid`
    );
    assert.ok(
      archive.document.name.trim().length > 0,
      `${manifest.id} project name must not be empty`
    );
    assert.equal(
      nodes.filter((node) => node.kind === 'bone').length,
      manifest.metrics.bones,
      `${manifest.id} bone count must match its manifest`
    );
    assert.equal(
      nodes.filter((node) => node.kind === 'cube').length,
      manifest.metrics.cubes,
      `${manifest.id} cube count must match its manifest`
    );
    assert.equal(
      Object.keys(archive.document.animations).length,
      manifest.metrics.animations,
      `${manifest.id} animation count must match its manifest`
    );
    const recipe = readPartRecipe(archive.document);
    assert.equal(recipe.ok, true, `${manifest.id} part recipe must be readable`);
    assert.equal(
      recipe.ok && recipe.recipe
        ? recipe.recipe.parts.filter(
            (part) => part.kind === 'feature' && part.motif === 'eye'
          ).length
        : 0,
      manifest.metrics.semanticEyes,
      `${manifest.id} semantic eye count must match its manifest`
    );
    if (recipe.ok && recipe.recipe) {
      const eyeIssues = auditEyeAnatomy(
        recipe.recipe.parts,
        archive.document.intent
          ? { requiredFace: archive.document.intent.forward }
          : {}
      );
      assert.deepEqual(
        eyeIssues,
        [],
        `${manifest.id} archive must preserve connected eye anatomy`
      );
      assert.deepEqual(
        auditEyeVisibility(archive.document),
        [],
        `${manifest.id} archive eyes must remain visibly delivered`
      );
      const partsById = new Map(
        recipe.recipe.parts.map((part) => [part.partId, part])
      );
      for (const eye of recipe.recipe.parts.filter(
        (part) => part.kind === 'feature' && part.motif === 'eye'
      )) {
        const parent = eye.parentPartId === null
          ? undefined
          : partsById.get(eye.parentPartId);
        assert.ok(
          parent?.kind === 'mass' || parent?.kind === 'segment',
          `${manifest.id} eye ${eye.partId} must belong to volumetric anatomy`
        );
      }
      if (archive.document.intent) {
        for (const terminal of recipe.recipe.parts.filter((part) =>
          /(?:foot|hoof|paw|toe|claw)(?:[._-]\d+)?$/i.test(part.partId)
        )) {
          const parent = terminal.parentPartId === null
            ? undefined
            : partsById.get(terminal.parentPartId);
          const terminalPoint = partTerminalPoint(terminal);
          const parentPoint = parent ? partTerminalPoint(parent) : null;
          assert.ok(
            terminalPoint && parentPoint,
            `${manifest.id} ${terminal.partId} needs a connected proximal limb`
          );
          if (!terminalPoint || !parentPoint) continue;
          assert.ok(
            forwardDistance(
              terminalPoint,
              archive.document.intent.forward
            ) > forwardDistance(
              parentPoint,
              archive.document.intent.forward
            ),
            `${manifest.id} ${terminal.partId} must point ` +
            `${archive.document.intent.forward}, matching the subject`
          );
        }
      }
    }

    const glbProject = projectForGlb(archive.document, manifest.id);
    assert.equal(
      evaluateProductionReadiness(glbProject).mechanicallyReady,
      true,
      `${manifest.id} finished archive must be production ready for GLB`
    );
    const bundle = await exportProductionProjectResolved(glbProject, {
      resolveBlob: async (source) => {
        const texture = Object.values(glbProject.textures).find((entry) =>
          entry.source.bucket === source.bucket &&
          entry.source.key === source.key
        );
        return texture ? archive.assets[texture.id] ?? null : null;
      }
    });
    const model = bundle.files.find((file) => file.kind === 'binary');
    assert.ok(model?.kind === 'binary', `${manifest.id} GLB must exist`);
    if (!model || model.kind !== 'binary') continue;
    const gltf = glbJson(model.data);
    const primitives = gltf.meshes?.flatMap((mesh) => mesh.primitives) ?? [];
    const triangles = primitives.reduce((count, primitive) =>
      count + Math.floor((gltf.accessors[primitive.indices]?.count ?? 0) / 3),
    0);
    assert.equal(
      primitives.length,
      manifest.metrics.glbPrimitives,
      `${manifest.id} GLB primitive count must match its manifest`
    );
    assert.equal(
      triangles,
      manifest.metrics.triangles,
      `${manifest.id} GLB triangle count must match its manifest`
    );
    assert.equal(
      gltf.animations?.length ?? 0,
      manifest.metrics.animations,
      `${manifest.id} GLB must preserve every animation clip`
    );
    const gltfReport = await validator.validateBytes(model.data, {
      uri: `${manifest.id}.glb`,
      format: 'glb'
    });
    assert.equal(
      gltfReport.issues.numErrors,
      0,
      `${manifest.id} GLB errors: ${JSON.stringify(gltfReport.issues.messages)}`
    );
  }
})();
