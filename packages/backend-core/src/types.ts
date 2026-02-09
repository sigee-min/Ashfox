import type { ToolName, ToolPayloadMap, ToolResultMap, ToolResponse } from '@ashfox/contracts/types/internal';

export type BackendKind = 'blockbench' | 'engine';

export type BackendAvailability = 'ready' | 'degraded' | 'offline';

export interface BackendSessionRef {
  tenantId: string;
  projectId: string;
  actorId: string;
  revision?: string;
}

export interface BackendHealth {
  kind: BackendKind;
  availability: BackendAvailability;
  version: string;
  details?: Record<string, unknown>;
}

export interface BackendToolContext {
  session: BackendSessionRef;
  traceId?: string;
}

export interface BackendPort {
  readonly kind: BackendKind;
  getHealth(): Promise<BackendHealth>;
  handleTool<TName extends ToolName>(
    name: TName,
    payload: ToolPayloadMap[TName],
    context: BackendToolContext
  ): Promise<ToolResponse<ToolResultMap[TName]>>;
}
