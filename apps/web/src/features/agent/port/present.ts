import {
  parsePresentRequest
} from '../parsePresentRequest';
import type {
  PresentRequest,
  PresentResult
} from '../types';
import type {
  AgentCommandPortDependencies
} from './types';
import type {
  AgentPortLifecycle
} from './AgentPortLifecycle';

export class PresentRequestController {
  constructor(
    private readonly dependencies: AgentCommandPortDependencies,
    private readonly lifecycle: AgentPortLifecycle
  ) {}

  present(input: PresentRequest): Promise<PresentResult> {
    const revision = this.dependencies.currentRevision();
    let parsed: ReturnType<typeof parsePresentRequest>;
    try {
      parsed = parsePresentRequest(input);
    } catch {
      parsed = {
        ok: false,
        error: {
          code: 'invalid_request',
          path: '$',
          expected: 'plain presentation request data'
        }
      };
    }
    return parsed.ok
      ? this.lifecycle.present(parsed.request)
      : Promise.resolve({
          ok: false,
          revision,
          error: parsed.error
        });
  }
}
