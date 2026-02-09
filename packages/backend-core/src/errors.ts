import type { ToolErrorCode, ToolResponse } from '@ashfox/contracts/types/internal';

export const backendToolError = (
  code: ToolErrorCode,
  message: string,
  fix?: string,
  details?: Record<string, unknown>
): ToolResponse<never> => ({
  ok: false,
  error: { code, message, fix, details }
});
