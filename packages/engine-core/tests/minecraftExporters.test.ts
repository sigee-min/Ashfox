import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildMinecraftBedrockGeometry,
  buildMinecraftBedrockAnimations,
  buildGeckoLib5Animations,
  buildGeckoLib5Geometry,
  buildMinecraftJavaModel,
  exportProject,
  exportMinecraftBedrock,
  exportGeckoLib5,
  exportMinecraftJavaBlock,
  type ProjectDocument
} from '../src';
import {
  createAnimatedBedrockProject,
  createBedrockProject,
  createGeckoLib5Project,
  createJavaProject
} from './helpers';

const fixture = (name: string): string =>
  readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

{
  const project = createJavaProject();
  const model = buildMinecraftJavaModel(project);
  assert.equal(model.format_version, '1.21.11');
  assert.equal(model.textures.base, 'ashfox:block/ashfox_crate');
  assert.equal(model.textures.particle, '#base');
  assert.equal(model.elements.length, 1);
  assert.deepEqual(model.elements[0].rotation, {
    origin: [0, 4, 0],
    axis: 'y',
    angle: 45
  });
  assert.deepEqual(model.elements[0].faces.north?.uv, [0, 0, 4, 4]);

  const bundle = exportMinecraftJavaBlock(project);
  assert.deepEqual(bundle.entrypoints, [
    'assets/ashfox/models/block/ashfox_crate.json'
  ]);
  assert.equal(bundle.files.length, 2);
  const modelFile = bundle.files[0];
  assert.equal(modelFile.kind, 'json');
  if (modelFile.kind !== 'json') throw new Error('model artifact missing');
  assert.equal(modelFile.text, fixture('minecraft-java-block.json'));
  const textureFile = bundle.files[1];
  assert.equal(textureFile.kind, 'blob-copy');
  assert.equal(
    textureFile.path,
    'assets/ashfox/textures/block/ashfox_crate.png'
  );
}

{
  const project = {
    ...createJavaProject(),
    name: '../../outside',
    formatProfile: {
      id: 'ashfox.generic',
      version: '1'
    }
  } as ProjectDocument;
  const bundle = exportProject(project);
  assert.deepEqual(bundle.entrypoints, ['project.json']);
  assert.equal(bundle.files[0]?.path, 'project.json');
}

{
  const project = createBedrockProject();
  const geometry = buildMinecraftBedrockGeometry(project);
  const body = geometry['minecraft:geometry'][0].bones[0];
  assert.equal(body.name, 'root');
  assert.deepEqual(body.cubes?.[0].origin, [-4, 0, -4]);
  assert.deepEqual(body.cubes?.[0].rotation, [0, -45, 0]);

  const bundle = exportMinecraftBedrock(project);
  assert.deepEqual(bundle.entrypoints, [
    'models/blocks/ashfox_crate.geo.json'
  ]);
  const geometryFile = bundle.files[0];
  assert.equal(geometryFile.kind, 'json');
  if (geometryFile.kind !== 'json') throw new Error('geometry artifact missing');
  assert.equal(geometryFile.text, fixture('minecraft-bedrock-geometry.json'));
  const textureFile = bundle.files[1];
  assert.equal(textureFile.kind, 'blob-copy');
  assert.equal(textureFile.path, 'textures/block/ashfox_crate.png');
}

{
  const project = createAnimatedBedrockProject();
  const locator = project.scene.nodes['locator-effect'];
  if (locator.kind !== 'locator') throw new Error('fixture locator missing');
  (locator as { ignoreInheritedScale: boolean }).ignoreInheritedScale = true;
  const animations = buildMinecraftBedrockAnimations(project);
  const geometry = buildMinecraftBedrockGeometry(project);
  const idle = animations.animations['animation.ashfox_crate.idle'];
  assert.equal(idle.loop, true);
  assert.deepEqual(idle.bones?.root.rotation?.['1.0'], [0, -30, 0]);
  assert.deepEqual(idle.particle_effects?.['0.5'], {
    effect: 'ashfox:crate_spark',
    locator: 'effect',
    bind_to_actor: true
  });
  assert.equal(
    geometry['minecraft:geometry'][0].bones[0]
      .locators?.effect.ignore_inherited_scale,
    true
  );
  const bundle = exportMinecraftBedrock(project);
  assert.deepEqual(bundle.entrypoints, [
    'models/blocks/ashfox_crate.geo.json',
    'animations/ashfox_crate.animation.json'
  ]);
}

{
  const bedrock = structuredClone(createAnimatedBedrockProject());
  const bedrockChannel =
    bedrock.animations['clip-idle'].channels['channel-root-rotation'];
  const bedrockKey = bedrockChannel.keys[1];
  (bedrockKey as {
    interpolation: 'catmullrom';
    preValue: [number, number, number];
    postValue: [number, number, number];
  }).interpolation = 'catmullrom';
  (bedrockKey as { preValue: [number, number, number] }).preValue = [0, 20, 0];
  (bedrockKey as { postValue: [number, number, number] }).postValue = [0, 30, 0];
  const bedrockAnimations = buildMinecraftBedrockAnimations(bedrock);
  assert.deepEqual(
    bedrockAnimations.animations['animation.ashfox_crate.idle']
      .bones?.root.rotation?.['1.0'],
    {
      pre: [0, -20, 0],
      post: [0, -30, 0],
      lerp_mode: 'catmullrom'
    }
  );

  const gecko = structuredClone(createGeckoLib5Project());
  const geckoChannel =
    gecko.animations['clip-idle'].channels['channel-root-rotation'];
  const geckoKey = geckoChannel.keys[1];
  (geckoKey as { interpolation: 'catmullrom' }).interpolation = 'catmullrom';
  const geckoAnimations = buildGeckoLib5Animations(gecko);
  assert.deepEqual(
    geckoAnimations.animations['animation.ashfox_crate.idle']
      .bones?.root.rotation?.['1.0'],
    {
      vector: [0, -30, 0],
      lerp_mode: 'catmullrom'
    }
  );
}

{
  const project = structuredClone(createAnimatedBedrockProject());
  const clip = project.animations['clip-idle'];
  (clip as { startDelay: { kind: 'molang'; source: string } }).startDelay = {
    kind: 'molang',
    source: '0.25'
  };
  (clip as { blendWeight: number }).blendWeight = 0.5;
  (clip as { overridePreviousAnimation: boolean })
    .overridePreviousAnimation = true;
  const particle = clip.triggers['trigger-particle'];
  if (particle.type !== 'particle') throw new Error('particle track missing');
  const original = particle.keys[0].value;
  if (Array.isArray(original)) throw new Error('unexpected particle array');
  (particle.keys[0] as { value: readonly [typeof original, typeof original] })
    .value = [
      original,
      {
        ...original,
        effect: 'ashfox:crate_smoke'
      }
    ];
  const animation = buildMinecraftBedrockAnimations(project)
    .animations['animation.ashfox_crate.idle'];
  assert.equal(animation.start_delay, '0.25');
  assert.equal(animation.blend_weight, 0.5);
  assert.equal(animation.override_previous_animation, true);
  assert.deepEqual(animation.particle_effects?.['0.5'], [
    {
      effect: 'ashfox:crate_spark',
      locator: 'effect',
      bind_to_actor: true
    },
    {
      effect: 'ashfox:crate_smoke',
      locator: 'effect',
      bind_to_actor: true
    }
  ]);
}

{
  const project = createGeckoLib5Project();
  const geometry = buildGeckoLib5Geometry(project);
  const animations = buildGeckoLib5Animations(project);
  assert.ok(animations.animations['animation.ashfox_crate.idle']);
  const bundle = exportGeckoLib5(project);
  assert.deepEqual(bundle.entrypoints, [
    'assets/ashfox/geckolib/models/block/ashfox_crate.geo.json',
    'assets/ashfox/geckolib/animations/block/ashfox_crate.animation.json'
  ]);
  const geometryFile = bundle.files[0];
  const animationFile = bundle.files[1];
  assert.equal(geometryFile?.kind, 'json');
  assert.equal(animationFile?.kind, 'json');
  if (geometryFile?.kind !== 'json' || animationFile?.kind !== 'json') {
    throw new Error('GeckoLib 5 JSON artifacts missing');
  }
  assert.equal(geometryFile.text, fixture('geckolib5-geometry.json'));
  assert.equal(animationFile.text, fixture('geckolib5-animation.json'));
  assert.equal(
    JSON.stringify(geometry),
    JSON.stringify(geometryFile.data)
  );
  assert.equal(
    bundle.files[2]?.path,
    'assets/ashfox/textures/block/ashfox_crate.png'
  );
}
