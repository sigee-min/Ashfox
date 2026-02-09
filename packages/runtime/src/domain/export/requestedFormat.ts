import type { ExportPayload } from '@ashfox/contracts/types/internal';
import type { ResolvedExportSelection } from './types';

export type ResolveRequestedExportResult =
  | { ok: true; value: ResolvedExportSelection }
  | { ok: false; reason: 'codec_required' | 'codec_empty' | 'codec_forbidden' };

export const resolveRequestedExport = (payload: ExportPayload): ResolveRequestedExportResult => {
  const codecId = normalizeCodecId(payload.codecId);
  if (payload.format === 'native_codec') {
    if (payload.codecId === undefined) return { ok: false, reason: 'codec_required' };
    if (!codecId) return { ok: false, reason: 'codec_empty' };
    return { ok: true, value: { format: payload.format, codecId } };
  }
  if (payload.codecId !== undefined) {
    return { ok: false, reason: 'codec_forbidden' };
  }
  return { ok: true, value: { format: payload.format } };
};

const normalizeCodecId = (value: string | undefined): string => String(value ?? '').trim();
