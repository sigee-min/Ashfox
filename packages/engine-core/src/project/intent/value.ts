import { compareStableText } from '../../stableOrder';

export type UnknownIntentRecord = Readonly<Record<string, unknown>>;

export const isIntentRecord = (
  value: unknown
): value is UnknownIntentRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const normalizeIntentText = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

export const uniqueStableText = (
  values: readonly string[]
): readonly string[] => [...new Set(values)].sort(compareStableText);
