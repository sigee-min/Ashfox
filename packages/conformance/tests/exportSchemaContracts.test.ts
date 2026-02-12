import assert from 'node:assert/strict';

import { toolSchemas } from '../../contracts/src/mcpSchemas/toolSchemas';
import { validateSchema } from '../../contracts/src/mcpSchemas/validation';

const exportSchema = toolSchemas.export;
const formatEnum =
  (exportSchema as { properties?: { format?: { enum?: string[] } } }).properties?.format?.enum ?? [];

assert.equal(formatEnum.includes('auto'), false);
assert.deepEqual(formatEnum, [
  'gecko_geo_anim',
  'gltf',
  'native_codec'
]);

{
  const res = validateSchema(exportSchema, { format: 'auto', destPath: 'out.json' });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.reason, 'enum');
    assert.equal(res.path, '$.format');
  }
}

{
  const res = validateSchema(exportSchema, { format: 'native_codec', codecId: 'obj', destPath: 'model.obj' });
  assert.deepEqual(res, { ok: true });
}

{
  const res = validateSchema(exportSchema, { format: 'gltf', destPath: 'model.glb', unexpected: true });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.reason, 'additionalProperties');
  }
}
