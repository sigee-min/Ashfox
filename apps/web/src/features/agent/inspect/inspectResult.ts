import type {
  InspectResult
} from '../types';

export const DEFAULT_INSPECT_LIMIT = 2048;
export const DETAIL_INSPECT_LIMIT = 16_384;
export const INSPECT_ID_LIMIT = 10;

export const invalidInspectRequest = (
  revision: string,
  path: string,
  expected: string
): InspectResult => ({
  ok: false,
  revision,
  error: {
    code: 'invalid_request',
    path,
    expected
  }
});

export const missingRecordId = <T>(
  record: Readonly<Record<string, T>>,
  ids: readonly string[]
): { id: string; index: number } | null => {
  const index = ids.findIndex(
    (id) => record[id] === undefined
  );
  return index < 0 ? null : { id: ids[index], index };
};

export const selectedRecordValues = <T>(
  record: Readonly<Record<string, T>>,
  ids: readonly string[]
): readonly T[] =>
  ids
    .slice(0, INSPECT_ID_LIMIT)
    .map((id) => record[id])
    .filter((value): value is T => value !== undefined);
