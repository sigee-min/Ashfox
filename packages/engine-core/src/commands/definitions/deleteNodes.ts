import { defineCommand } from '../definition';
import { entityIdsSchema } from './schemas';
import { findMissingNodeId } from './sceneHelpers';
import { removeSceneNodes } from './removeSceneNodes';

const inputSchema = {
  type: 'object',
  properties: {
    nodeIds: entityIdsSchema
  },
  required: ['nodeIds'],
  additionalProperties: false
} as const;

export const deleteNodesCommand = defineCommand({
  name: 'scene.nodes.delete',
  label: 'Delete nodes',
  purpose: 'Delete scene nodes, their descendants, and dependent animation references.',
  inputSchema,
  apply: (document, payload) => {
    const missingId = findMissingNodeId(document, payload.nodeIds);
    if (missingId) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: `Scene node "${missingId}" does not exist.`,
          path: 'payload.nodeIds'
        }
      };
    }
    const removal = removeSceneNodes(document, payload.nodeIds);
    return {
      ok: true,
      value: {
        document: removal.document,
        summary:
          `Delete ${removal.removedNodeIds.length} node` +
          `${removal.removedNodeIds.length === 1 ? '' : 's'}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: removal.changedEntityIds,
          removedEntityIds: removal.removedEntityIds,
          invalidated: [
            'scene',
            'textures',
            'uv',
            'animations',
            'validation',
            'preview'
          ]
        }
      }
    };
  }
});
