import {
  parseInspectRequest
} from '../parseInspectRequest';
import type {
  InspectRequest,
  InspectResult
} from '../types';
import type {
  AgentCommandPortDependencies
} from './types';

export class InspectRequestController {
  constructor(
    private readonly dependencies: AgentCommandPortDependencies
  ) {}

  inspect(request?: InspectRequest): InspectResult {
    const revision = this.dependencies.currentRevision();
    let parsed: ReturnType<typeof parseInspectRequest>;
    try {
      parsed = parseInspectRequest(request);
    } catch {
      parsed = {
        ok: false,
        error: {
          code: 'invalid_request',
          path: '$',
          expected: 'plain inspect request data'
        }
      };
    }
    if (!parsed.ok) {
      return {
        ok: false,
        revision,
        error: parsed.error
      };
    }
    try {
      return this.dependencies.inspect(parsed.request);
    } catch {
      return {
        ok: false,
        revision,
        error: {
          code: 'invalid_request',
          path: '$',
          expected: 'valid inspect request'
        }
      };
    }
  }
}
