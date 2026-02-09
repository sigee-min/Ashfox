import assert from 'node:assert/strict';

import { resolveRequestedExport } from '../src/domain/export/requestedFormat';

{
  const result = resolveRequestedExport({ format: 'native_codec', destPath: 'model.obj' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'codec_required');
}

{
  const result = resolveRequestedExport({ format: 'native_codec', codecId: '   ', destPath: 'model.obj' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'codec_empty');
}

{
  const result = resolveRequestedExport({ format: 'gltf', codecId: 'obj', destPath: 'model.gltf' });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'codec_forbidden');
}

{
  const result = resolveRequestedExport({ format: 'native_codec', codecId: ' obj ', destPath: 'model.obj' });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.format, 'native_codec');
    assert.equal(result.value.codecId, 'obj');
  }
}

{
  const result = resolveRequestedExport({ format: 'gltf', destPath: 'model.gltf' });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.format, 'gltf');
}

