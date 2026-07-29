import { transformsEqual, updateSceneNode } from '../../scene';
import { defineCommand } from '../definition';
import { entityIdsSchema, partialTransformSchema } from './schemas';

const inputSchema = {
  type: 'object',
  properties: {
    nodeIds: entityIdsSchema,
    transform: partialTransformSchema
  },
  required: ['nodeIds', 'transform'],
  additionalProperties: false
} as const;

export const transformNodesCommand = defineCommand({
  name: 'scene.nodes.transform',
  label: 'Transform nodes',
  purpose: 'Set one or more local transform properties on scene nodes.',
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
        const transform = {
          ...node.transform,
          ...payload.transform
        };
        if (transformsEqual(node.transform, transform)) return node;
        changedEntityIds.push(nodeId);
        return {
          ...node,
          transform
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
        summary: `Transform ${subject}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds,
          removedEntityIds: [],
          invalidated: ['scene', 'animations', 'validation', 'preview']
        }
      }
    };
  }
});
