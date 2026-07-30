import { updateSceneNode } from '../../scene';
import { defineCommand } from '../definition';
import { vec3Schema } from './schemas';

const inputSchema = {
  type: 'object',
  properties: {
    updates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nodeId: {
            type: 'string',
            minLength: 1
          },
          bounds: {
            type: 'object',
            properties: {
              from: vec3Schema,
              to: vec3Schema
            },
            required: ['from', 'to'],
            additionalProperties: false
          },
          inflate: {
            type: 'number'
          }
        },
        required: ['nodeId'],
        additionalProperties: false
      },
      minItems: 1,
      maxItems: 128
    }
  },
  required: ['updates'],
  additionalProperties: false
} as const;

export const updateCubeGeometryCommand = defineCommand({
  name: 'scene.cubes.geometry.update',
  label: 'Update cube geometry',
  purpose:
    'Update cube bounds or inflation; generated UVs remain owned by texture synchronization.',
  inputSchema,
  apply: (document, payload) => {
    const ids = payload.updates.map((update) => update.nodeId);
    const duplicateId = ids.find(
      (nodeId, index) => ids.indexOf(nodeId) !== index
    );
    const missingOrNonCube = ids.find(
      (nodeId) => document.scene.nodes[nodeId]?.kind !== 'cube'
    );
    const emptyUpdate = payload.updates.find(
      (update) =>
        update.bounds === undefined &&
        update.inflate === undefined
    );
    if (duplicateId || missingOrNonCube || emptyUpdate) {
      return {
        ok: false,
        error: {
          code: duplicateId || emptyUpdate
            ? 'invalid_payload'
            : 'invalid_state',
          message: duplicateId
            ? `Cube "${duplicateId}" is updated more than once.`
            : missingOrNonCube
              ? `Scene node "${missingOrNonCube}" is not an existing cube.`
              : 'Cube geometry update must change bounds or inflation.',
          path: 'payload.updates'
        }
      };
    }
    const next = payload.updates.reduce(
      (current, update) =>
        updateSceneNode(current, update.nodeId, (node) => {
          if (node.kind !== 'cube') return node;
          return {
            ...node,
            ...(update.bounds === undefined
              ? {}
              : { bounds: update.bounds }),
            ...(update.inflate === undefined
              ? {}
              : { inflate: update.inflate })
          };
        }),
      document
    );
    return {
      ok: true,
      value: {
        document: next,
        summary:
          `Update ${ids.length} cube geometr${ids.length === 1 ? 'y' : 'ies'}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: ids,
          removedEntityIds: [],
          invalidated: ['scene', 'textures', 'uv', 'validation', 'preview']
        }
      }
    };
  }
});
