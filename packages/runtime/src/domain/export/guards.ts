import type { Capabilities } from '@ashfox/contracts/types/internal';

export type ExportFormatGuardResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'authoring_not_enabled';
    };

export const ensureExportFormatEnabled = (
  capabilities: Capabilities,
  requiresAuthoringFormat: boolean
): ExportFormatGuardResult => {
  if (!requiresAuthoringFormat) return { ok: true };
  if (!capabilities.authoring.enabled) {
    return { ok: false, reason: 'authoring_not_enabled' };
  }
  return { ok: true };
};
