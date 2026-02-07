import assert from 'node:assert/strict';

import {
  DEFAULT_SERVER_HOST,
  DEFAULT_SERVER_PATH,
  DEFAULT_SERVER_PORT,
  PLUGIN_ID,
  computeCapabilities
} from '../../src/config';
import type { FormatDescriptor } from '../../src/ports/formats';

{
  assert.equal(PLUGIN_ID, 'bbmcp');
  assert.equal(DEFAULT_SERVER_HOST, '0.0.0.0');
  assert.equal(DEFAULT_SERVER_PORT, 8787);
  assert.equal(DEFAULT_SERVER_PATH, '/mcp');
}

{
  const capabilities = computeCapabilities(undefined, []);
  assert.equal(capabilities.blockbenchVersion, 'unknown');
  assert.equal(capabilities.formats.length, 3);
  assert.equal(capabilities.formats.every((format) => format.enabled === false), true);
  assert.equal(capabilities.guidance?.retryPolicy?.maxAttempts, 2);
}

{
  const formats: FormatDescriptor[] = [
    { id: 'java_block', name: 'Java Block', singleTexture: true, perTextureUvSize: false },
    { id: 'geckolib', name: 'GeckoLib', singleTexture: false, perTextureUvSize: true },
    { id: 'animated_java', name: 'Animated Java' }
  ];
  const capabilities = computeCapabilities('5.0.7', formats, { 'Java Block/Item': 'java_block' }, { mode: 'fixed' });
  assert.equal(capabilities.blockbenchVersion, '5.0.7');
  assert.equal(capabilities.preview?.mode, 'fixed');

  const java = capabilities.formats.find((entry) => entry.format === 'Java Block/Item');
  const gecko = capabilities.formats.find((entry) => entry.format === 'geckolib');
  const animated = capabilities.formats.find((entry) => entry.format === 'animated_java');
  assert.equal(java?.enabled, true);
  assert.equal(java?.flags?.singleTexture, true);
  assert.equal(java?.flags?.perTextureUvSize, false);
  assert.equal(gecko?.enabled, true);
  assert.equal(gecko?.flags?.singleTexture, false);
  assert.equal(gecko?.flags?.perTextureUvSize, true);
  assert.equal(animated?.enabled, true);
  assert.equal(animated?.flags, undefined);
}

