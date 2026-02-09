import type { ToolName, ToolPayloadMap, ToolResultMap, ToolResponse } from '@ashfox/contracts/types/internal';
import {
  backendToolError,
  type BackendHealth,
  type BackendPort,
  type BackendToolContext,
  type PersistenceHealth,
  type PersistencePorts
} from '@ashfox/backend-core';

export interface EngineBackendOptions {
  version?: string;
  details?: Record<string, unknown>;
  persistence?: PersistencePorts;
}

export class EngineBackend implements BackendPort {
  readonly kind = 'engine' as const;
  private readonly version: string;
  private readonly details?: Record<string, unknown>;
  private readonly persistence?: PersistencePorts;

  constructor(options: EngineBackendOptions = {}) {
    this.version = options.version ?? '0.0.0-dev';
    this.details = options.details;
    this.persistence = options.persistence;
  }

  async getHealth(): Promise<BackendHealth> {
    const persistence: PersistenceHealth | undefined = this.persistence?.health;
    return {
      kind: this.kind,
      availability: 'degraded',
      version: this.version,
      details: {
        reason: 'engine_scaffold_only',
        ...(persistence ? { persistence } : {}),
        ...this.details
      }
    };
  }

  async handleTool<TName extends ToolName>(
    _name: TName,
    _payload: ToolPayloadMap[TName],
    _context: BackendToolContext
  ): Promise<ToolResponse<ToolResultMap[TName]>> {
    return backendToolError(
      'not_implemented',
      'Engine backend scaffold is active but tool execution is not implemented yet.',
      'Use blockbench backend for production calls until engine-core lands.',
      { backend: this.kind }
    ) as ToolResponse<ToolResultMap[TName]>;
  }
}

export const createEngineBackend = (options?: EngineBackendOptions): BackendPort => new EngineBackend(options);
