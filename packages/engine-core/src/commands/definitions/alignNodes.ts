import { updateSceneNode } from '../../scene';
import { defineCommand } from '../definition';
import { axisSchema, entityIdsSchema } from './schemas';
import { axisIndex, findMissingNodeId } from './sceneHelpers';

const inputSchema = {
  type: 'object',
  properties: {
    nodeIds: entityIdsSchema,
    axis: axisSchema,
    mode: {
      enum: ['minimum', 'center', 'maximum']
    }
  },
  required: ['nodeIds', 'axis', 'mode'],
  additionalProperties: false
} as const;

export const alignNodesCommand = defineCommand({
  name: 'scene.nodes.align',
  label: 'Align nodes',
  purpose: 'Align node positions to a shared minimum, center, or maximum.',
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
    const index = axisIndex(payload.axis);
    const values = payload.nodeIds.map(
      (nodeId) => document.scene.nodes[nodeId].transform.position[index]
    );
    const target = payload.mode === 'minimum'
      ? Math.min(...values)
      : payload.mode === 'maximum'
        ? Math.max(...values)
        : values.reduce((sum, value) => sum + value, 0) / values.length;
    const next = payload.nodeIds.reduce(
      (current, nodeId) =>
        updateSceneNode(current, nodeId, (node) => {
          const position: [number, number, number] = [
            ...node.transform.position
          ];
          position[index] = target;
          return {
            ...node,
            transform: {
              ...node.transform,
              position
            }
          };
        }),
      document
    );
    return {
      ok: true,
      value: {
        document: next,
        summary: `Align ${payload.nodeIds.length} nodes on ${payload.axis.toUpperCase()}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: payload.nodeIds,
          removedEntityIds: [],
          invalidated: ['scene', 'animations', 'validation', 'preview']
        }
      }
    };
  }
});
