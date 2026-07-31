import type {
  ProjectDocument
} from '@ashfox/engine-core';

import {
  boundedSuccess
} from '../boundedResult';
import {
  inspectClipAuthoring
} from '../inspectClip';
import type {
  InspectRequest,
  InspectResult
} from '../types';
import {
  DETAIL_INSPECT_LIMIT,
  invalidInspectRequest
} from './inspectResult';

type ClipInspectRequest = Extract<InspectRequest, { kind: 'clip' }>;

export const inspectClipRequest = (
  document: ProjectDocument,
  request: ClipInspectRequest
): InspectResult => {
  const clip = document.animations[request.id];
  if (!clip) {
    return {
      ok: false,
      revision: document.revision,
      error: {
        code: 'not_found',
        path: 'id',
        expected: 'existing animation clip ID'
      }
    };
  }
  if (
    request.trackId !== undefined &&
    !clip.channels[request.trackId]
  ) {
    return {
      ok: false,
      revision: document.revision,
      error: {
        code: 'not_found',
        path: 'trackId',
        expected: 'existing transform track ID in this clip'
      }
    };
  }
  const authoring = inspectClipAuthoring(
    document,
    clip,
    request.trackId,
    request.cursor,
    request.limit
  );
  if (authoring === null) {
    return invalidInspectRequest(
      document.revision,
      'cursor',
      'clip page cursor from the previous response'
    );
  }
  return boundedSuccess(
    document.revision,
    authoring,
    DETAIL_INSPECT_LIMIT
  );
};
