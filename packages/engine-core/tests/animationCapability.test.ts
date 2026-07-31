import assert from 'node:assert/strict';

import {
  AnimationExportCapabilityError,
  analyzeProjectAnimationCapabilities,
  buildGltf,
  evaluateProductionReadiness,
  validateProjectDocument,
  type AnimationClip,
  type ProjectDocument
} from '../src';
import {
  createGeckoLib5Project,
  createGltfProject
} from './helpers';

const cloneClip = (
  clip: AnimationClip,
  id: string,
  name: string
): AnimationClip => {
  const result = structuredClone(clip);
  (result as { id: string }).id = id;
  (result as { name: string }).name = name;
  for (const channel of Object.values(result.channels)) {
    (channel as { id: string }).id = `${channel.id}-${id}`;
    for (const keyframe of channel.keys) {
      (keyframe as { id: string }).id = `${keyframe.id}-${id}`;
    }
  }
  return result;
};

const gltfWithSecondaryClip = (): {
  project: ProjectDocument;
  clip: AnimationClip;
} => {
  const project = structuredClone(createGltfProject('gltf'));
  const clip = cloneClip(
    project.animations['clip-idle'],
    'clip-secondary',
    'Secondary'
  );
  (project.animations as Record<string, AnimationClip>)[clip.id] = clip;
  return { project, clip };
};

{
  const project = structuredClone(createGltfProject('gltf'));
  const clip = project.animations['clip-idle'];
  (clip as { blendWeight: number }).blendWeight = 1;
  (clip as {
    overridePreviousAnimation: boolean;
  }).overridePreviousAnimation = false;
  const report = analyzeProjectAnimationCapabilities(project);
  assert.equal(report.exportable, true);
  assert.equal(report.previewable, true);
  assert.equal(validateProjectDocument(project).valid, true);
  assert.doesNotThrow(
    () => buildGltf(project),
    'neutral blend controls accepted by the gate must compile'
  );
}

{
  const { project, clip } = gltfWithSecondaryClip();
  const channel = Object.values(clip.channels)[0];
  (channel.keys[0].value as [unknown, number, number])[0] = {
    kind: 'molang',
    source: 'query.life_time'
  };
  const report = analyzeProjectAnimationCapabilities(project);
  const secondary = report.clips.find(
    (entry) => entry.clipId === clip.id
  );
  assert.equal(secondary?.previewable, false);
  assert.equal(secondary?.exportable, false);
  assert.ok(
    secondary?.previewIssues.some((issue) => issue.code === 'molang')
  );
  assert.ok(
    secondary?.exportIssues.some((issue) => issue.code === 'molang')
  );
  assert.throws(() => buildGltf(project), AnimationExportCapabilityError);
}

{
  const { project, clip } = gltfWithSecondaryClip();
  (clip.triggers as Record<string, object>)['trigger-secondary'] = {
    id: 'trigger-secondary',
    type: 'timeline',
    keys: [{
      id: 'trigger-secondary-key',
      timeSeconds: 0.5,
      value: 'variable.demo = 1;'
    }]
  };
  const report = analyzeProjectAnimationCapabilities(project);
  const secondary = report.clips.find(
    (entry) => entry.clipId === clip.id
  );
  assert.equal(
    secondary?.previewable,
    true,
    'visual review follows the lowered GLB transform animation'
  );
  assert.equal(secondary?.exportable, true);
  assert.ok(
    secondary?.exportAdaptations.some(
      (adaptation) =>
        adaptation.disposition === 'omitted' &&
        adaptation.code === 'timeline_trigger'
    )
  );
  assert.doesNotThrow(() => buildGltf(project));
}

{
  const { project, clip } = gltfWithSecondaryClip();
  const channel = Object.values(clip.channels)[0];
  (channel.keys[1] as {
    interpolation: 'step';
  }).interpolation = 'step';
  const report = analyzeProjectAnimationCapabilities(project);
  const secondary = report.clips.find(
    (entry) => entry.clipId === clip.id
  );
  assert.equal(
    secondary?.previewable,
    true,
    'mixed outgoing-segment interpolation is faithfully previewable'
  );
  assert.equal(secondary?.exportable, false);
  assert.ok(
    secondary?.exportIssues.some(
      (issue) => issue.code === 'mixed_interpolation'
    )
  );
  assert.throws(() => buildGltf(project), AnimationExportCapabilityError);
}

{
  const project = structuredClone(createGeckoLib5Project());
  const clip = project.animations['clip-idle'];
  const channel = Object.values(clip.channels)[0];
  (channel.keys[0].value as [unknown, number, number])[0] = {
    kind: 'molang',
    source: 'query.life_time'
  };
  const report = analyzeProjectAnimationCapabilities(project);
  assert.equal(report.exportable, true);
  assert.equal(report.previewable, false);
}

{
  const project = structuredClone(createGeckoLib5Project());
  project.formatProfile = {
    id: 'minecraft.bedrock',
    minecraftVersion: '1.26.0',
    geometryFormatVersion: '1.21.0',
    animationFormatVersion: '1.8.0',
    namespace: 'ashfox',
    modelPath: 'ashfox_crate',
    animationPath: 'ashfox_crate',
    geometryKind: 'block',
    geometryIdentifier: 'geometry.ashfox_crate'
  };
  const channel = Object.values(
    project.animations['clip-idle'].channels
  )[0];
  (channel.keys[1] as {
    interpolation: 'step';
  }).interpolation = 'step';
  const report = analyzeProjectAnimationCapabilities(project);
  assert.equal(report.exportable, false);
  assert.ok(
    report.clips[0].exportIssues.some(
      (issue) => issue.code === 'easing'
    )
  );
}

{
  const project = structuredClone(createGltfProject('gltf'));
  const idle = project.animations['clip-idle'];
  const channel = idle.channels['channel-root-rotation'];
  const keys = [...channel.keys];
  keys[keys.length - 1] = {
    ...keys[keys.length - 1],
    value: keys[0].value
  };
  idle.channels = {
    ...idle.channels,
    [channel.id]: { ...channel, keys }
  };
  project.intent = {
    subject: 'Crate',
    forward: 'north',
    grounding: 'free',
    features: ['Human confirms the crate reads correctly.']
  };
  const secondary = cloneClip(idle, 'clip-wave', 'Wave');
  (secondary as { startDelay: object }).startDelay = {
    kind: 'molang',
    source: '0.25'
  };
  (project.animations as Record<string, AnimationClip>)[secondary.id] =
    secondary;
  const readiness = evaluateProductionReadiness(project);
  assert.equal(
    readiness.findings.some(
      (finding) =>
        finding.code === 'production.animation_preview_unfaithful' &&
        finding.clipIds?.includes(secondary.id)
    ),
    false,
    'safe playback omissions do not alter the authored transform preview'
  );
  assert.equal(
    readiness.findings.some(
      (finding) =>
        finding.code === 'production.animation_export_unsupported' &&
        finding.clipIds?.includes(secondary.id)
    ),
    false,
    'safe playback omissions must not make a numeric clip unexportable'
  );
}
