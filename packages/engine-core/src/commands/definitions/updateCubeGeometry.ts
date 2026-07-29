import { CUBE_FACE_DIRECTIONS } from '../../model';
import { updateSceneNode } from '../../scene';
import { defineCommand } from '../definition';
import {
  uvRectSchema,
  vec2Schema,
  vec3Schema
} from './schemas';

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
          },
          mirror: {
            type: 'boolean'
          },
          boxUv: {
            type: 'boolean'
          },
          uvOffset: {
            anyOf: [
              vec2Schema,
              {
                enum: [null]
              }
            ]
          },
          faceUv: uvRectSchema
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

const hasGeometryChange = (
  update: {
    bounds?: unknown;
    inflate?: unknown;
    mirror?: unknown;
    boxUv?: unknown;
    uvOffset?: unknown;
    faceUv?: unknown;
  }
): boolean =>
  update.bounds !== undefined ||
  update.inflate !== undefined ||
  update.mirror !== undefined ||
  update.boxUv !== undefined ||
  update.uvOffset !== undefined ||
  update.faceUv !== undefined;

export const updateCubeGeometryCommand = defineCommand({
  name: 'scene.cubes.geometry.update',
  label: 'Update cube geometry',
  purpose: 'Update existing cube bounds and box or face UV geometry.',
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
      (update) => !hasGeometryChange(update)
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
              : 'Cube geometry update must change at least one property.',
          path: 'payload.updates'
        }
      };
    }
    const next = payload.updates.reduce(
      (current, update) =>
        updateSceneNode(current, update.nodeId, (node) => {
          if (node.kind !== 'cube') return node;
          const faces = update.faceUv
            ? Object.fromEntries(
                CUBE_FACE_DIRECTIONS.map((direction) => [
                  direction,
                  {
                    ...node.faces[direction],
                    uv: update.faceUv
                  }
                ])
              ) as typeof node.faces
            : node.faces;
          return {
            ...node,
            ...(update.bounds === undefined
              ? {}
              : { bounds: update.bounds }),
            ...(update.inflate === undefined
              ? {}
              : { inflate: update.inflate }),
            ...(update.mirror === undefined
              ? {}
              : { mirror: update.mirror }),
            ...(update.boxUv === undefined
              ? {}
              : { boxUv: update.boxUv }),
            ...(update.uvOffset === undefined
              ? {}
              : update.uvOffset === null
                ? { uvOffset: undefined }
                : { uvOffset: update.uvOffset }),
            faces
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
