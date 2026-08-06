import { isRecord } from '../../domain/guards';
import { isFiniteJsonValue } from '@ashfox/internal-contracts';

export type TriggerPayloadValue = string | string[] | Record<string, unknown>;

export const isValidTriggerPayloadValue = (value: unknown): value is TriggerPayloadValue =>
  typeof value === 'string' ||
  (Array.isArray(value) && value.every((item) => typeof item === 'string')) ||
  (isRecord(value) && isFiniteJsonValue(value));
