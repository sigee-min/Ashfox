import type { FormatDescriptor } from '../../ports/formats';
import type { SessionState } from '../../session';
import { resolveFormatId, type FormatOverrides } from '../formats';

export const resolveExportFormatId = (
  snapshot: SessionState,
  requiresAuthoringFormat: boolean,
  formats: FormatDescriptor[],
  overrides?: FormatOverrides,
  activeFormatId?: string | null
): string | null => {
  if (snapshot.formatId) return snapshot.formatId;
  if (!requiresAuthoringFormat) return null;
  return resolveFormatId(formats, overrides, activeFormatId);
};
