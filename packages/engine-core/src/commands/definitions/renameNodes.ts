import { updateSceneNode } from '../../scene';
import { defineCommand } from '../definition';

const inputSchema = {
  type: 'object',
  properties: {
    renames: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nodeId: {
            type: 'string',
            minLength: 1
          },
          name: {
            type: 'string',
            minLength: 1
          }
        },
        required: ['nodeId', 'name'],
        additionalProperties: false
      },
      minItems: 1,
      maxItems: 128
    }
  },
  required: ['renames'],
  additionalProperties: false
} as const;

export const renameNodesCommand = defineCommand({
  name: 'scene.nodes.rename',
  label: 'Rename nodes',
  purpose: 'Rename one or more existing scene nodes by ID.',
  inputSchema,
  apply: (document, payload) => {
    const ids = payload.renames.map((rename) => rename.nodeId);
    const duplicateId = ids.find(
      (nodeId, index) => ids.indexOf(nodeId) !== index
    );
    const missingId = ids.find((nodeId) => !document.scene.nodes[nodeId]);
    const emptyName = payload.renames.find(
      (rename) => rename.name.trim().length === 0
    );
    if (duplicateId || missingId || emptyName) {
      return {
        ok: false,
        error: {
          code: duplicateId || emptyName
            ? 'invalid_payload'
            : 'invalid_state',
          message: duplicateId
            ? `Scene node "${duplicateId}" is renamed more than once.`
            : missingId
              ? `Scene node "${missingId}" does not exist.`
              : 'Scene node name cannot be empty.',
          path: 'payload.renames'
        }
      };
    }
    const next = payload.renames.reduce(
      (current, rename) =>
        updateSceneNode(current, rename.nodeId, (node) => ({
          ...node,
          name: rename.name.trim()
        })),
      document
    );
    return {
      ok: true,
      value: {
        document: next,
        summary: `Rename ${ids.length} node${ids.length === 1 ? '' : 's'}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: ids,
          removedEntityIds: [],
          invalidated: ['scene', 'animations', 'validation', 'preview']
        }
      }
    };
  }
});
