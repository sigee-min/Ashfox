import {
  getAgentCommandDefinition,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  boundedSuccess
} from '../boundedResult';
import {
  schemaHash
} from '../schemaHash';
import type {
  InspectResult
} from '../types';
import {
  DETAIL_INSPECT_LIMIT
} from './inspectResult';

export const inspectCommand = (
  document: ProjectDocument,
  name: string
): InspectResult => {
  const definition = getAgentCommandDefinition(name);
  if (!definition) {
    return {
      ok: false,
      revision: document.revision,
      error: {
        code: 'not_found',
        path: 'name',
        expected: 'registered command'
      }
    };
  }
  return boundedSuccess(
    document.revision,
    {
      name: definition.name,
      label: definition.label,
      purpose: definition.purpose,
      schemaHash: schemaHash(definition.inputSchema),
      inputSchema: definition.inputSchema
    },
    DETAIL_INSPECT_LIMIT
  );
};
