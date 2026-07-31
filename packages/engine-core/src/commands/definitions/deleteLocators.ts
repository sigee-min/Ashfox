import { compareStableText } from '../../stableOrder';
import { defineCommand } from '../definition';
import { entityIdsSchema } from './schemas';
import { removeSceneNodes } from './removeSceneNodes';

const inputSchema = {
  type: 'object',
  properties: {
    locatorIds: entityIdsSchema
  },
  required: ['locatorIds'],
  additionalProperties: false
} as const;

export const deleteLocatorsCommand = defineCommand({
  name: 'scene.locators.delete',
  label: 'Delete locators',
  purpose:
    'Delete existing attachment locators and dependent animation event references.',
  inputSchema,
  apply: (document, payload) => {
    const invalidIndex = payload.locatorIds.findIndex(
      (locatorId) =>
        document.scene.nodes[locatorId]?.kind !== 'locator'
    );
    if (invalidIndex >= 0) {
      const invalidId = payload.locatorIds[invalidIndex];
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: `Locator "${invalidId}" does not exist.`,
          path: `payload.locatorIds[${invalidIndex}]`,
          expected: 'existing locator IDs'
        }
      };
    }
    const removal = removeSceneNodes(
      document,
      payload.locatorIds
    );
    return {
      ok: true,
      value: {
        document: removal.document,
        summary:
          `Delete ${payload.locatorIds.length} locator` +
          `${payload.locatorIds.length === 1 ? '' : 's'}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds:
            [...removal.changedEntityIds].sort(compareStableText),
          removedEntityIds:
            [...removal.removedEntityIds].sort(compareStableText),
          invalidated: [
            'scene',
            'animations',
            'validation',
            'preview'
          ]
        }
      }
    };
  }
});
