import type { ToolError } from '../types';

export const isBlankString = (value?: string): boolean => typeof value === 'string' && value.trim().length === 0;

export const ensureNonBlankString = (value: unknown, label: string): ToolError | null => {
  if (typeof value === 'string' && value.trim().length === 0) {
    return { code: 'invalid_payload', message: `${label} must be a non-empty string.` };
  }
  return null;
};

type IdNameItem = { id?: string | null; name: string };

export const ensureIdNameMatch = <T extends IdNameItem>(
  items: T[],
  id: string | undefined,
  name: string | undefined,
  options: { kind: string; plural: string; idLabel?: string; nameLabel?: string }
): ToolError | null => {
  if (!id || !name) return null;
  const byId = items.find((item) => item.id === id);
  const byName = items.find((item) => item.name === name);
  if (byId && byName && byId !== byName) {
    const idLabel = options.idLabel ?? 'id';
    const nameLabel = options.nameLabel ?? 'name';
    return {
      code: 'invalid_payload',
      message: `${options.kind} ${idLabel} and ${nameLabel} refer to different ${options.plural} (${id}, ${name}).`
    };
  }
  return null;
};
