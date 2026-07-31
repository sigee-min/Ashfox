import assert from 'node:assert/strict';

import type {
  ProjectSceneProjection
} from '../src/rendering/sceneTypes';
import {
  waitForProjectionTextures
} from '../src/features/capture/gifCaptureSurface';

const projection = (
  readiness: ProjectSceneProjection['readiness'],
  ready: Promise<void>
): ProjectSceneProjection => ({
  root: null as never,
  objectsByNodeId: new Map(),
  selectable: [],
  readiness,
  ready,
  dispose: () => undefined
});

export const test = (async (): Promise<void> => {
  await waitForProjectionTextures(
    projection(
      { status: 'ready', error: null },
      Promise.resolve()
    ),
    new AbortController().signal
  );

  await assert.rejects(
    waitForProjectionTextures(
      projection(
        {
          status: 'failed',
          error: 'Texture "broken" could not be decoded.'
        },
        Promise.resolve()
      ),
      new AbortController().signal
    ),
    /could not be decoded/
  );

  const pending = new AbortController();
  const waiting = waitForProjectionTextures(
    projection(
      { status: 'pending', error: null },
      new Promise(() => undefined)
    ),
    pending.signal
  );
  pending.abort();
  await assert.rejects(
    waiting,
    (error: unknown) =>
      error instanceof DOMException &&
      error.name === 'AbortError'
  );
})();
