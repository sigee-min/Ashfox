import assert from 'node:assert/strict';

import {
  DEFAULT_SERVER_HOST,
  DEFAULT_SERVER_PATH,
  DEFAULT_SERVER_PORT,
  PLUGIN_ID,
  computeCapabilities
} from '../src/config';
import type { FormatDescriptor } from '../src/ports/formats';

{
  assert.equal(PLUGIN_ID, 'ashfox');
  assert.equal(DEFAULT_SERVER_HOST, '0.0.0.0');
  assert.equal(DEFAULT_SERVER_PORT, 8787);
  assert.equal(DEFAULT_SERVER_PATH, '/mcp');
}

{
  const capabilities = computeCapabilities(undefined, []);
  assert.equal(capabilities.blockbenchVersion, 'unknown');
  assert.equal(capabilities.authoring.enabled, false);
  assert.equal(capabilities.guidance?.retryPolicy?.maxAttempts, 2);
}

{
  const formats: FormatDescriptor[] = [
    {
      id: 'entity_rig',
      name: 'GeckoLib',
      singleTexture: false,
      perTextureUvSize: true,
      animationMode: true,
      boneRig: true
    }
  ];
  const capabilities = computeCapabilities('5.0.7', formats, { formatId: 'entity_rig' }, { mode: 'fixed' });
  assert.equal(capabilities.blockbenchVersion, '5.0.7');
  assert.equal(capabilities.preview?.mode, 'fixed');

  assert.equal(capabilities.authoring.enabled, true);
  assert.equal(capabilities.authoring.flags?.singleTexture, false);
  assert.equal(capabilities.authoring.flags?.perTextureUvSize, true);
  assert.equal(capabilities.authoring.flags?.animationMode, true);
  assert.equal(capabilities.authoring.flags?.boneRig, true);
}
