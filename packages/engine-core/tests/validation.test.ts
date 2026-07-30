import assert from 'node:assert/strict';

import {
  validateProjectDocument,
  type ProjectDocument
} from '../src';
import {
  createGeckoLib5Project,
  createGltfProject,
  createJavaProject
} from './helpers';

const clone = <T>(value: T): T => structuredClone(value);

{
  const report = validateProjectDocument(createJavaProject());
  assert.equal(report.valid, true);
  assert.deepEqual(report.findings, []);
}

{
  const project = clone(createJavaProject()) as ProjectDocument;
  const outer = project.scene.nodes['cube-body'];
  if (outer.kind !== 'cube') throw new Error('fixture cube missing');
  outer.transform = {
    ...outer.transform,
    rotation: [0, 0, 0]
  };
  (project.textures['texture-base'] as {
    atlasMode: 'generate';
  }).atlasMode = 'generate';
  (project.scene.nodes as Record<string, typeof outer>)['cube-hidden'] = {
    ...structuredClone(outer),
    id: 'cube-hidden',
    name: 'hidden',
    bounds: {
      from: [-1, 2, -1],
      to: [1, 4, 1]
    }
  };
  const report = validateProjectDocument(project);
  assert.equal(report.valid, true);
  assert.ok(
    report.findings.some(
      (finding) =>
        finding.code === 'cube.fully_occluded' &&
        finding.severity === 'warning' &&
        finding.entityIds?.includes('cube-hidden') &&
        finding.entityIds.includes('cube-body')
    )
  );

  (
    project.scene.nodes['cube-hidden'] as typeof outer
  ).bounds = {
    from: [-1, 2, -1],
    to: [5, 4, 1]
  };
  assert.ok(
    !validateProjectDocument(project).findings.some(
      (finding) => finding.code === 'cube.fully_occluded'
    )
  );
}

{
  const project = clone(createJavaProject());
  (project.scene.roots as string[]).push('bone-root');
  const report = validateProjectDocument(project);
  assert.equal(report.valid, false);
  assert.ok(report.findings.some((finding) => finding.code === 'scene.root_duplicate'));
}

{
  const project = clone(createJavaProject());
  const cube = project.scene.nodes['cube-body'];
  if (cube.kind !== 'cube') throw new Error('fixture cube missing');
  (cube.faces.north as { textureId: string }).textureId = 'texture-missing';
  const report = validateProjectDocument(project);
  assert.equal(report.valid, false);
  assert.ok(report.findings.some((finding) => finding.code === 'cube.texture_missing'));
}

{
  const project = clone(createJavaProject());
  const bone = project.scene.nodes['bone-root'];
  (bone.transform as { rotation: [number, number, number] }).rotation = [0, 15, 0];
  const report = validateProjectDocument(project);
  assert.equal(report.valid, false);
  assert.ok(report.findings.some((finding) => finding.code === 'format.unbaked_transform'));
}

{
  const project = clone(createJavaProject());
  const cube = project.scene.nodes['cube-body'];
  if (cube.kind !== 'cube') throw new Error('fixture cube missing');
  (cube.bounds as { from: [number, number, number] }).from = [-20, 0, -4];
  const report = validateProjectDocument(project);
  assert.equal(report.valid, false);
  assert.ok(report.findings.some((finding) => finding.code === 'format.coordinate_overflow'));
}

{
  const project = clone(createJavaProject()) as ProjectDocument;
  const cube = project.scene.nodes['cube-body'];
  if (cube.kind !== 'cube') throw new Error('fixture cube missing');
  (cube.faces.up as { uv?: undefined }).uv = undefined;
  const report = validateProjectDocument(project);
  assert.equal(report.valid, false);
  assert.ok(report.findings.some((finding) => finding.code === 'format.uv_missing'));
}

{
  const project = clone(createJavaProject()) as ProjectDocument;
  const texture = project.textures['texture-base'];
  (project.textures as Record<string, typeof texture>)['texture-copy'] = {
    ...texture,
    id: 'texture-copy',
    minecraft: {
      ...texture.minecraft!,
      key: 'copy',
      particle: false
    }
  };
  const report = validateProjectDocument(project);
  assert.equal(report.valid, false);
  assert.ok(report.findings.some((finding) => finding.code === 'format.texture_path_duplicate'));
}

{
  const project = clone(createJavaProject()) as ProjectDocument;
  const texture = project.textures['texture-base'];
  (project.textures as Record<string, typeof texture>)['texture-copy'] = {
    ...texture,
    id: 'texture-copy',
    source: {
      ...texture.source,
      key: 'project-crate/copy.png'
    },
    minecraft: {
      ...texture.minecraft!,
      key: 'copy',
      resource: {
        namespace: 'ashfox',
        path: 'block/copy'
      },
      particle: true
    }
  };
  const report = validateProjectDocument(project);
  assert.equal(report.valid, false);
  assert.ok(report.findings.some((finding) => finding.code === 'format.texture_key_duplicate'));
}

{
  const project = clone(createJavaProject()) as ProjectDocument;
  const texture = project.textures['texture-base'];
  (texture.source as { key: string }).key = '../outside.png';
  const report = validateProjectDocument(project);
  assert.equal(report.valid, false);
  assert.ok(report.findings.some((finding) => finding.code === 'texture.invalid_blob'));
}

{
  const project = clone(createJavaProject()) as ProjectDocument;
  const cube = project.scene.nodes['cube-body'];
  if (cube.kind !== 'cube') throw new Error('fixture cube missing');
  (cube.faces.north as { rotation: number }).rotation = 45;
  const report = validateProjectDocument(project);
  assert.equal(report.valid, false);
  assert.ok(report.findings.some((finding) => finding.code === 'cube.invalid_face'));
}

{
  const project = clone(createGeckoLib5Project()) as ProjectDocument;
  const cube = project.scene.nodes['cube-body'];
  if (cube.kind !== 'cube') throw new Error('fixture cube missing');
  for (const face of Object.values(cube.faces)) {
    (face as { textureId: null }).textureId = null;
  }
  (project as {
    textures: Record<string, never>;
  }).textures = {};
  const report = validateProjectDocument(project);
  assert.equal(report.valid, true);
  assert.ok(
    report.findings.some(
      (finding) =>
        finding.code === 'format.texture_missing' &&
        finding.severity === 'warning'
    )
  );
}

{
  const project = clone(createGeckoLib5Project()) as ProjectDocument;
  (project as { animations: Record<string, never> }).animations = {};
  const report = validateProjectDocument(project);
  assert.equal(report.valid, false);
  assert.ok(
    report.findings.some(
      (finding) =>
        finding.code === 'format.unsupported_data' &&
        finding.path === 'animations'
    )
  );
}

{
  const project = clone(createGltfProject()) as ProjectDocument;
  const clip = project.animations['clip-idle'];
  const channel = clip.channels['channel-root-rotation'];
  const keyframe = channel.keys[1];
  (keyframe.value as [number, number, unknown])[1] = {
    kind: 'molang',
    source: 'query.anim_time'
  };
  const report = validateProjectDocument(project);
  assert.equal(report.valid, false);
  assert.ok(
    report.findings.some(
      (finding) =>
        finding.code === 'format.unsupported_data' &&
        finding.message.includes('Molang')
    )
  );
}

{
  const project = clone(createGeckoLib5Project()) as ProjectDocument;
  const clip = project.animations['clip-idle'];
  const channel = clip.channels['channel-root-rotation'];
  (channel.keys[1] as { interpolation: 'step' }).interpolation = 'step';
  const report = validateProjectDocument(project);
  assert.equal(report.valid, true);
}

{
  const project = clone(createGeckoLib5Project()) as ProjectDocument;
  const clip = project.animations['clip-idle'];
  (clip as { startDelay: { kind: 'molang'; source: string } }).startDelay = {
    kind: 'molang',
    source: '0.25'
  };
  (clip as { blendWeight: number }).blendWeight = 0.5;
  const report = validateProjectDocument(project);
  assert.equal(report.valid, true);
}

{
  const project = clone(createGeckoLib5Project()) as ProjectDocument;
  const particle = project.animations['clip-idle']
    .triggers['trigger-particle'];
  if (particle.type !== 'particle') throw new Error('particle track missing');
  const effect = particle.keys[0].value;
  if (Array.isArray(effect)) throw new Error('unexpected particle array');
  (particle.keys[0] as {
    value: readonly [typeof effect, typeof effect];
  }).value = [effect, effect];
  const report = validateProjectDocument(project);
  assert.equal(report.valid, false);
  assert.ok(
    report.findings.some(
      (finding) =>
        finding.code === 'format.unsupported_data' &&
        finding.message.includes('particle')
    )
  );
}

{
  const project = clone(createGeckoLib5Project()) as ProjectDocument;
  project.formatProfile = {
    id: 'minecraft.bedrock',
    version: '1.21.0',
    animationFormatVersion: '1.8.0',
    namespace: 'ashfox',
    modelPath: 'ashfox_crate',
    animationPath: 'ashfox_crate',
    geometryKind: 'block',
    geometryIdentifier: 'geometry.ashfox_crate'
  };
  const channel = project.animations['clip-idle']
    .channels['channel-root-rotation'];
  (channel.keys[1] as { interpolation: 'step' }).interpolation = 'step';
  const report = validateProjectDocument(project);
  assert.equal(report.valid, false);
  assert.ok(
    report.findings.some(
      (finding) =>
        finding.code === 'format.unsupported_data' &&
        finding.message.includes('STEP')
    )
  );
}

{
  const project = clone(createGltfProject()) as ProjectDocument;
  const clip = project.animations['clip-idle'];
  (clip.triggers as Record<string, object>)['event'] = {
    id: 'event',
    type: 'timeline',
    keys: [
      {
        id: 'event-key',
        timeSeconds: 0.5,
        value: 'variable.test = 1.0;'
      }
    ]
  };
  const report = validateProjectDocument(project);
  assert.equal(report.valid, false);
  assert.ok(
    report.findings.some(
      (finding) =>
        finding.code === 'format.unsupported_data' &&
        finding.path === 'animations.clip-idle.triggers'
    )
  );
}
