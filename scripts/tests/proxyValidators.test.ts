import assert from 'node:assert/strict';

import { toolSchemas } from '../../src/mcp/toolSchemas';
import { validateSchema } from '../../src/mcp/validation';
import type { ApplyModelSpecPayload, TexturePipelinePayload } from '../../src/spec';
import { validateModelSpec, validateTexturePipeline } from '../../src/proxy/validators';

const limits = { maxCubes: 2048, maxTextureSize: 256, maxAnimationSeconds: 120 };

// Runtime validator sanity: valid rig template should pass.
{
  const payload: ApplyModelSpecPayload = { model: { rigTemplate: 'biped', parts: [] } };
  const res = validateModelSpec(payload, limits);
  assert.equal(res.ok, true);
}

// Runtime validator sanity: empty pipeline should fail with invalid_payload.
{
  const payload: TexturePipelinePayload = {};
  const res = validateTexturePipeline(payload, limits);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error.code, 'invalid_payload');
  }
}

// Schema-level contract: unknown rigTemplate rejected.
{
  const res = validateSchema(toolSchemas.apply_model_spec, { model: { rigTemplate: 'nope', parts: [] } });
  assert.equal(res.ok, false);
}

// Schema-level contract: unknown preset name rejected.
{
  const res = validateSchema(toolSchemas.texture_pipeline, {
    presets: [{ preset: 'nope', width: 16, height: 16 }]
  });
  assert.equal(res.ok, false);
}
