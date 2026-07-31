import type {
  InspectResult
} from '../types';
import {
  boundedSuccess
} from '../boundedResult';
import {
  DETAIL_INSPECT_LIMIT,
  INSPECT_ID_LIMIT,
  invalidInspectRequest,
  missingRecordId,
  selectedRecordValues
} from './inspectResult';

interface InspectRecordSelectionInput<T> {
  revision: string;
  record: Readonly<Record<string, T>>;
  ids: readonly string[];
  label: 'entity' | 'texture';
}

export const inspectRecordSelection = <T>({
  revision,
  record,
  ids,
  label
}: InspectRecordSelectionInput<T>): InspectResult => {
  if (ids.length > INSPECT_ID_LIMIT) {
    return invalidInspectRequest(
      revision,
      'ids',
      `at most ${INSPECT_ID_LIMIT} ${label} IDs`
    );
  }
  const missing = missingRecordId(record, ids);
  if (missing) {
    return {
      ok: false,
      revision,
      error: {
        code: 'not_found',
        path: `ids[${missing.index}]`,
        expected: `existing ${label === 'entity' ? 'scene entity' : label} ID`
      }
    };
  }
  return boundedSuccess(
    revision,
    selectedRecordValues(record, ids),
    DETAIL_INSPECT_LIMIT
  );
};
