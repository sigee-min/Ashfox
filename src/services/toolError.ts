import type { ToolError, ToolErrorCode } from '../types';

const DEFAULT_FIXES: Partial<Record<ToolErrorCode, string>> = {
  invalid_payload: 'Check the input parameters and retry',
  invalid_state: 'Call get_project_state and retry',
  not_implemented: 'This operation is not available in the current host',
  unsupported_format: 'Use list_capabilities to pick a supported format',
  no_change: 'Adjust the input and retry',
  io_error: 'Check file paths and permissions and retry',
  unknown: 'Retry the operation or check logs'
};

const DEFAULT_MESSAGE_HINTS: Partial<Record<ToolErrorCode, string>> = {
  invalid_payload: 'Invalid payload.',
  invalid_state: 'Invalid state.',
  not_implemented: 'Not implemented.',
  unsupported_format: 'Unsupported format.',
  no_change: 'No changes detected.',
  io_error: 'I/O error.',
  unknown: 'Unknown error.'
};

export const applyToolErrorPolicy = (error: ToolError): ToolError => {
  const message = normalizeMessage(error.message, error.code);
  const fix = normalizeFix(error.fix ?? DEFAULT_FIXES[error.code]);
  return fix ? { ...error, message, fix } : { ...error, message };
};

const normalizeFix = (value?: string): string | undefined => {
  if (!value) return undefined;
  return normalizeSentence(value);
};

const normalizeMessage = (value: string, code: ToolErrorCode): string => {
  const trimmed = value.trim();
  if (!trimmed) return normalizeSentence(DEFAULT_MESSAGE_HINTS[code] ?? value);
  return normalizeSentence(normalizeTerminology(trimmed));
};

const normalizeSentence = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const last = trimmed[trimmed.length - 1];
  if (last === '.' || last === '?' || last === '!') return trimmed;
  return `${trimmed}.`;
};

const normalizeTerminology = (value: string): string =>
  value
    .replace(/uvUsageId/g, 'UV usage id')
    .replace(/uvPaint/g, 'UV paint')
    .replace(/textureResolution/g, 'texture resolution')
    .replace(/get_project_state/g, 'get_project_state')
    .replace(/set_project_texture_resolution/g, 'set_project_texture_resolution')
    .replace(/apply_texture_spec/g, 'apply_texture_spec');
