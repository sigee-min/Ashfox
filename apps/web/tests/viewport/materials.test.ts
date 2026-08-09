import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  configureTextureMap,
  materialEmissionIntensity
} from '../../src/rendering/sceneMaterials';
import type { TextureAsset } from '@ashfox/engine-core';

assert.equal(materialEmissionIntensity('default'), 0);
assert.equal(materialEmissionIntensity('emissive'), 1.15);
assert.equal(materialEmissionIntensity('additive'), 1.15);
assert.equal(materialEmissionIntensity('default', 15), 2.5);
assert.equal(materialEmissionIntensity('emissive', 10), 10 / 6);
assert.equal(materialEmissionIntensity('default', -1), 0);

const texture = (
  atlasMode: TextureAsset['atlasMode'],
  sampling: TextureAsset['sampling']
): TextureAsset => ({
  id: `texture-${atlasMode}-${sampling}`,
  name: `${atlasMode} ${sampling}`,
  width: 16,
  height: 16,
  source: {
    bucket: 'local',
    key: 'texture.png',
    contentType: 'image/png',
    contentHash: 'sha256:test'
  },
  visible: true,
  sampling,
  colorSpace: 'srgb',
  renderMode: 'default',
  renderSides: 'auto',
  atlasMode
});

const generatedMap = configureTextureMap(
  new THREE.Texture(),
  texture('generate', 'linear')
);
assert.equal(generatedMap.magFilter, THREE.NearestFilter);
assert.equal(generatedMap.minFilter, THREE.NearestFilter);
assert.equal(generatedMap.generateMipmaps, false);

const preservedMap = configureTextureMap(
  new THREE.Texture(),
  texture('preserve', 'nearest')
);
assert.equal(preservedMap.magFilter, THREE.NearestFilter);
assert.equal(
  preservedMap.minFilter,
  THREE.NearestMipmapNearestFilter
);
assert.equal(
  preservedMap.generateMipmaps,
  true,
  'preserved texture sampling behavior must remain unchanged'
);
