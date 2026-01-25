import { FORMAT_KINDS, PROJECT_STATE_DETAILS } from '../shared/toolConstants';

export type FormatKind = typeof FORMAT_KINDS[number];

export type ProjectStateDetail = typeof PROJECT_STATE_DETAILS[number];

export { FORMAT_KINDS, PROJECT_STATE_DETAILS };

export interface IncludeStateOption {
  includeState?: boolean;
}

export interface IncludeDiffOption {
  includeDiff?: boolean;
  diffDetail?: ProjectStateDetail;
}

export interface IfRevisionOption {
  ifRevision?: string;
}

export type ToolErrorCode =
  | 'unsupported_format'
  | 'not_implemented'
  | 'invalid_state'
  | 'invalid_state_revision_mismatch'
  | 'invalid_payload'
  | 'no_change'
  | 'io_error'
  | 'unknown';

export interface ToolError {
  code: ToolErrorCode;
  message: string;
  fix?: string;
  details?: Record<string, unknown>;
}

export type McpTextContent = { type: 'text'; text: string };

export type McpImageContent = { type: 'image'; data: string; mimeType: string };

export type McpContentBlock = McpTextContent | McpImageContent;

export type ToolResponse<T> =
  | { ok: true; data: T; content?: McpContentBlock[]; structuredContent?: unknown }
  | { ok: false; error: ToolError; content?: McpContentBlock[]; structuredContent?: unknown };
