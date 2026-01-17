import { Dispatcher, ToolResponse } from '../types';
import { ProxyRouter } from '../proxy';

export interface ToolExecutor {
  callTool: (name: string, args: unknown) => Promise<ToolResponse<unknown>>;
}

export class LocalToolExecutor implements ToolExecutor {
  private readonly dispatcher: Dispatcher;
  private readonly proxy: ProxyRouter;

  constructor(dispatcher: Dispatcher, proxy: ProxyRouter) {
    this.dispatcher = dispatcher;
    this.proxy = proxy;
  }

  async callTool(name: string, args: unknown): Promise<ToolResponse<unknown>> {
    if (
      name === 'apply_model_spec' ||
      name === 'apply_texture_spec' ||
      name === 'apply_anim_spec' ||
      name === 'apply_project_spec'
    ) {
      return normalizeToolResponse(this.proxy.handle(name as any, args));
    }
    return normalizeToolResponse(this.dispatcher.handle(name as any, args as any));
  }
}

const normalizeToolResponse = (response: ToolResponse<unknown>): ToolResponse<unknown> => {
  if (response.ok) return response;
  const details = { ...(response.error.details ?? {}) };
  if (typeof details.reason !== 'string' || details.reason.length === 0) {
    details.reason = response.error.code;
  }
  return { ok: false, error: { ...response.error, details } };
};
