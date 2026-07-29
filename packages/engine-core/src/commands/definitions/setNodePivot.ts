import { updateSceneNode } from '../../scene';
import { defineCommand } from '../definition';
import { entityIdsSchema, vec3Schema } from './schemas';
import { findMissingNodeId } from './sceneHelpers';

const inputSchema = {
  type: 'object',
  properties: {
    nodeIds: entityIdsSchema,
    pivot: vec3Schema
  },
  required: ['nodeIds', 'pivot'],
  additionalProperties: false
} as const;

export const setNodePivotCommand = defineCommand({
  name: 'scene.nodes.pivot',
  label: 'Set pivots',
  purpose: 'Set a shared model-space pivot on one or more scene nodes.',
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
    const next = payload.nodeIds.reduce(
      (current, nodeId) =>
        updateSceneNode(current, nodeId, (node) => ({
          ...node,
          transform: {
            ...node.transform,
            pivot: payload.pivot
          }
        })),
      document
    );
    return {
      ok: true,
      value: {
        document: next,
        summary: `Set ${payload.nodeIds.length} pivot${payload.nodeIds.length === 1 ? '' : 's'}`,
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
