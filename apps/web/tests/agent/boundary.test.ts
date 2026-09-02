import assert from 'node:assert/strict';

import { agentManifest } from '../../src/features/agent/agentManifest';
import { parseCaptureRequest } from '../../src/features/agent/parseCaptureRequest';

const manifest = JSON.stringify(agentManifest);
assert.equal(manifest.includes('add_bone'), false,
  'The Web Studio agent manifest must not expose live Blockbench bone edits.');
assert.equal(manifest.includes('add_cube'), false,
  'The Web Studio agent manifest must not expose live Blockbench cube edits.');
assert.deepEqual(agentManifest.commands.map((entry) => entry.name), [
  'workspace.apply'
]);
assert.equal(agentManifest.pageApi.captureMethod, 'capture');
assert.match(
  agentManifest.pageApi.capture.build,
  /Build replay starts from an empty scene, places every visible element in deterministic canonical element order, applies each element's complete owning texture set atomically, activates canonical authored idle motion when available, and holds on the complete model\./u
);
assert.deepEqual(parseCaptureRequest({ kind: 'build' }), {
  ok: true,
  request: { kind: 'build' }
});
for (const invalid of [
  { kind: 'unknown' },
  { kind: 'build', clipId: 'idle' }
]) {
  assert.equal(
    parseCaptureRequest(invalid).ok,
    false,
    'Capture accepts only the exact build-replay request.'
  );
}

console.log('Web Studio manifest exposes only atomic workspace replacement');
