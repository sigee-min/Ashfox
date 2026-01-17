import { ToolError, ToolName, ToolPayloadMap } from '../types';
import { ProxyTool } from '../spec';

export const PROTOCOL_VERSION = 1 as const;

export type SidecarRole = 'plugin' | 'sidecar';
export type SidecarMode = 'direct' | 'proxy';

export type SidecarHelloMessage = {
  type: 'hello';
  version: number;
  role: SidecarRole;
  ts: number;
};

export type SidecarReadyMessage = {
  type: 'ready';
  version: number;
  ts: number;
};

export type SidecarRequestMessage = {
  type: 'request';
  id: string;
  ts: number;
  mode?: SidecarMode;
  tool: ToolName | ProxyTool;
  payload: ToolPayloadMap[ToolName] | unknown;
};

export type SidecarResponseMessage = {
  type: 'response';
  id: string;
  ts: number;
  ok: boolean;
  data?: unknown;
  error?: ToolError;
};

export type SidecarErrorMessage = {
  type: 'error';
  ts: number;
  id?: string;
  message: string;
  details?: Record<string, unknown>;
};

export type SidecarMessage =
  | SidecarHelloMessage
  | SidecarReadyMessage
  | SidecarRequestMessage
  | SidecarResponseMessage
  | SidecarErrorMessage;
