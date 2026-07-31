import assert from 'node:assert/strict';

import {
  validateProjectDocument,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  createGltfProject
} from '../../../packages/engine-core/tests/helpers';
import {
  deliverAgentProject
} from '../src/features/agent/deliverAgentProject';
import type {
  VisualReviewReceipt
} from '../src/features/agent/presentationReview';
import {
  requiredVisualReviews
} from '../src/features/agent/visualReviewPlan';
import type {
  ArtifactFile
} from '../src/features/files/artifactFile';
import type {
  FileOperationRunResult
} from '../src/features/files/useFileOperation';

const document = structuredClone(
  createGltfProject('glb', 'embedded')
);
document.intent = {
  subject: 'Crate',
  forward: 'north',
  grounding: 'free',
  features: ['Confirm the crate silhouette.']
};
const idle = document.animations['clip-idle'];
const idleChannel = idle.channels['channel-root-rotation'];
document.animations = {
  idle: {
    ...idle,
    id: 'idle',
    channels: {
      ...idle.channels,
      'channel-root-rotation': {
        ...idleChannel,
        keys: idleChannel.keys.map((key, index) =>
          index === idleChannel.keys.length - 1
            ? {
                ...key,
                value: idleChannel.keys[0].value
              }
            : key
        )
      }
    }
  }
};
const reviews: readonly VisualReviewReceipt[] =
  requiredVisualReviews(document).map((review, index) => ({
    projectId: document.id,
    revision: document.revision,
    mode: review.mode,
    camera: review.camera,
    clipId: review.clipId,
    observedTimeSeconds: 0,
    completedCycles: review.mode === 'cycle' ? 1 : 0,
    frameNonce: index + 1,
    verdict: 'accepted',
    issues: []
  }));
const artifact: ArtifactFile = {
  kind: 'target',
  name: 'ashfox_crate.glb',
  contentType: 'model/gltf-binary',
  bytes: new Uint8Array([1, 2, 3]),
  projectId: document.id,
  sourceRevision: document.revision,
  target: 'glb',
  contentHash: 'sha256:test'
};
const delivered: FileOperationRunResult<ArtifactFile> = {
  ok: true,
  operationId: 1,
  result: artifact
};

export const test = (async (): Promise<void> => {
{
  let exportCalls = 0;
  const incomplete = await deliverAgentProject({
    document,
    report: validateProjectDocument(document),
    visualReviews: [],
    currentDocument: () => document,
    exportTarget: async () => {
      exportCalls += 1;
      return delivered;
    }
  });
  assert.equal(incomplete.ok, false);
  if (!incomplete.ok) {
    assert.equal(incomplete.error.path, 'review');
  }
  assert.equal(exportCalls, 0);
}

{
  const invalid: ProjectDocument = {
    ...document,
    animations: {}
  };
  let exportCalls = 0;
  const blocked = await deliverAgentProject({
    document: invalid,
    report: validateProjectDocument(invalid),
    visualReviews: [],
    currentDocument: () => invalid,
    exportTarget: async () => {
      exportCalls += 1;
      return delivered;
    }
  });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.equal(blocked.error.code, 'invalid_state');
    assert.match(blocked.error.path ?? '', /animations/);
  }
  assert.equal(exportCalls, 0);
}

{
  let current = document;
  let resolveExport:
    ((result: FileOperationRunResult<ArtifactFile>) => void) | undefined;
  const pending = deliverAgentProject({
    document,
    report: validateProjectDocument(document),
    visualReviews: reviews,
    currentDocument: () => current,
    exportTarget: () =>
      new Promise<FileOperationRunResult<ArtifactFile>>((resolve) => {
        resolveExport = resolve;
      })
  });
  assert.ok(resolveExport);
  current = {
    ...document,
    revision: 'revision-2'
  };
  resolveExport(delivered);
  const stale = await pending;
  assert.equal(stale.ok, false);
  if (!stale.ok) {
    assert.equal(stale.revision, 'revision-2');
    assert.equal(stale.error.code, 'invalid_state');
    assert.equal(stale.error.path, 'revision');
    assert.equal(stale.error.expected, document.revision);
  }
}

{
  const result = await deliverAgentProject({
    document,
    report: validateProjectDocument(document),
    visualReviews: reviews,
    currentDocument: () => document,
    exportTarget: async () => delivered
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.artifact.name, artifact.name);
    assert.equal(result.artifact.byteLength, artifact.bytes.byteLength);
  }
}
})();
