import type { FormatDescriptor } from '../ports/formats';

export type FormatOverrides = {
  formatId?: string;
};

export function resolveFormatId(
  formats: FormatDescriptor[],
  overrides?: FormatOverrides,
  activeFormatId?: string | null
): string | null {
  const overrideId = normalizeFormatId(overrides?.formatId);
  if (overrideId && existsFormat(formats, overrideId)) {
    return overrideId;
  }

  const activeId = normalizeFormatId(activeFormatId);
  if (activeId && existsFormat(formats, activeId)) {
    return activeId;
  }

  if (formats.length === 1) {
    return formats[0].id;
  }

  const ranked = formats
    .map((format) => ({ format, score: scoreFormat(format) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return a.format.id.localeCompare(b.format.id);
    });

  if (ranked.length === 0) return null;
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) return null;
  return ranked[0].format.id;
}

const normalizeFormatId = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const existsFormat = (formats: FormatDescriptor[], id: string): boolean =>
  formats.some((format) => format.id === id);

const scoreFormat = (format: FormatDescriptor): number => {
  let score = 0;
  if (format.boneRig) score += 100;
  if (format.animationMode) score += 50;
  if (format.armatureRig) score += 25;
  if (format.perTextureUvSize) score += 5;
  return score;
};
