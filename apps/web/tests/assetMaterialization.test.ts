import assert from 'node:assert/strict';

import {
  evaluateAssetMaterialization
} from '../src/features/files/assetMaterialization';
import {
  createWorkbenchProject
} from './fixtures/workbenchProject';

const source = createWorkbenchProject();
const generated = evaluateAssetMaterialization(source, {});
assert.equal(generated.materialized, true);

const texture = source.textures['texture-base'];
const { raster: _raster, ...withoutRaster } = texture;
const preserved = {
  ...source,
  textures: {
    'texture-base': {
      ...withoutRaster,
      atlasMode: 'preserve' as const,
      source: {
        ...withoutRaster.source,
        contentType: 'image/png',
        byteLength: 4
      }
    }
  }
};
assert.deepEqual(
  evaluateAssetMaterialization(preserved, {}).issues,
  [{
    textureId: 'texture-base',
    code: 'bytes_missing'
  }]
);
assert.deepEqual(
  evaluateAssetMaterialization(preserved, {
    'texture-base': {
      contentType: 'image/jpeg',
      bytes: new Uint8Array(4)
    }
  }).issues,
  [{
    textureId: 'texture-base',
    code: 'content_type_mismatch'
  }]
);
assert.equal(
  evaluateAssetMaterialization(preserved, {
    'texture-base': {
      contentType: 'image/png',
      bytes: new Uint8Array(4)
    }
  }).materialized,
  true
);
