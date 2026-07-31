import {
  canonicalJsonString
} from '@ashfox/engine-core';

import {
  parseCaptureRequest
} from '../parseCaptureRequest';
import type {
  AgentCaptureRequest,
  CaptureResult
} from '../types';
import type {
  AgentCommandPortDependencies
} from './agentCommandPortTypes';
import type {
  AgentPortLifecycle
} from './AgentPortLifecycle';

export class CaptureRequestController {
  constructor(
    private readonly dependencies: AgentCommandPortDependencies,
    private readonly lifecycle: AgentPortLifecycle
  ) {}

  capture(input: AgentCaptureRequest): Promise<CaptureResult> {
    const revision = this.dependencies.currentRevision();
    let parsed: ReturnType<typeof parseCaptureRequest>;
    try {
      parsed = parseCaptureRequest(input);
    } catch {
      parsed = {
        ok: false,
        error: {
          code: 'invalid_request',
          path: '$',
          expected: 'plain capture request data'
        }
      };
    }
    return parsed.ok
      ? this.lifecycle.capture(
          parsed.request,
          canonicalJsonString(parsed.request)
        )
      : Promise.resolve({
          ok: false,
          revision,
          error: parsed.error
        });
  }
}
