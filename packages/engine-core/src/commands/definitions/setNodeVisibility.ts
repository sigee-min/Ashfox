import { updateSceneNode } from '../../scene';
import { defineCommand } from '../definition';
import { entityIdsSchema } from './schemas';

const inputSchema = {
  type: 'object',
  properties: {
    nodeIds: entityIdsSchema,
    visible: {
      type: 'boolean'
    }
  },
  required: ['nodeIds', 'visible'],
  additionalProperties: false
} as const;

export const setNodeVisibilityCommand = defineCommand({
  name: 'scene.nodes.visibility',
  label: 'Set node visibility',
  purpose: 'Set viewport and export visibility for one or more scene nodes.',
  inputSchema,
  apply: (document, payload) => {
    const missingId = payload.nodeIds.find(
      (nodeId) => !document.scene.nodes[nodeId]
    );
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

    let next = document;
    const changedEntityIds: string[] = [];
    for (const nodeId of payload.nodeIds) {
      next = updateSceneNode(next, nodeId, (node) => {
        if (node.visible === payload.visible) return node;
        changedEntityIds.push(nodeId);
        return {
          ...node,
          visible: payload.visible
        };
      });
    }

    const subject = payload.nodeIds.length === 1
      ? document.scene.nodes[payload.nodeIds[0]].name
      : `${payload.nodeIds.length} nodes`;
    return {
      ok: true,
      value: {
        document: next,
        summary: `${payload.visible ? 'Show' : 'Hide'} ${subject}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds,
          removedEntityIds: [],
          invalidated: ['scene', 'validation', 'preview']
        }
      }
    };
  }
});
