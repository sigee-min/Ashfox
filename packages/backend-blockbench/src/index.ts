import type { Dispatcher, ToolName, ToolPayloadMap, ToolResultMap, ToolResponse } from '@ashfox/contracts/types/internal';
import { backendToolError, type BackendHealth, type BackendPort, type BackendToolContext } from '@ashfox/backend-core';

export interface BlockbenchBackendOptions {
  dispatcher?: Dispatcher;
  version?: string;
  details?: Record<string, unknown>;
}

export class BlockbenchBackend implements BackendPort {
  readonly kind = 'blockbench' as const;
  private readonly dispatcher: Dispatcher | null;
  private readonly version: string;
  private readonly details?: Record<string, unknown>;

  constructor(options: BlockbenchBackendOptions = {}) {
    this.dispatcher = options.dispatcher ?? null;
    this.version = options.version ?? '0.0.0-dev';
    this.details = options.details;
  }

  async getHealth(): Promise<BackendHealth> {
    if (!this.dispatcher) {
      return {
        kind: this.kind,
        availability: 'offline',
        version: this.version,
        details: {
          reason: 'dispatcher_missing',
          ...this.details
        }
      };
    }
    return {
      kind: this.kind,
      availability: 'ready',
      version: this.version,
      details: this.details
    };
  }

  async handleTool<TName extends ToolName>(
    name: TName,
    payload: ToolPayloadMap[TName],
    _context: BackendToolContext
  ): Promise<ToolResponse<ToolResultMap[TName]>> {
    if (!this.dispatcher) {
      return backendToolError(
        'invalid_state',
        'Blockbench backend is offline: dispatcher is not connected.',
        'Start the Blockbench plugin runtime and reconnect gateway.',
        { backend: this.kind }
      ) as ToolResponse<ToolResultMap[TName]>;
    }
    try {
      return await this.dispatcher.handle(name, payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return backendToolError(
        'unknown',
        `Blockbench backend adapter failed: ${message}`,
        'Inspect backend logs and retry.',
        { backend: this.kind }
      ) as ToolResponse<ToolResultMap[TName]>;
    }
  }
}

export const createBlockbenchBackend = (options?: BlockbenchBackendOptions): BackendPort =>
  new BlockbenchBackend(options);
