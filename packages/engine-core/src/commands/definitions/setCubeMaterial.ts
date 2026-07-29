import { CUBE_FACE_DIRECTIONS } from '../../model';
import { updateSceneNode } from '../../scene';
import { defineCommand } from '../definition';
import {
  entityIdsSchema,
  nullableEntityIdSchema
} from './schemas';
import {
  findMissingNodeId,
  findNonCube
} from './sceneHelpers';

const inputSchema = {
  type: 'object',
  properties: {
    nodeIds: entityIdsSchema,
    textureId: nullableEntityIdSchema,
    shade: {
      type: 'boolean'
    },
    lightEmission: {
      type: 'number',
      minimum: 0,
      maximum: 15
    }
  },
  required: ['nodeIds', 'textureId'],
  additionalProperties: false
} as const;

export const setCubeMaterialCommand = defineCommand({
  name: 'scene.cubes.material',
  label: 'Set cube material',
  purpose: 'Assign one texture and deterministic shading settings to cube faces.',
  inputSchema,
  apply: (document, payload) => {
    const missingId = findMissingNodeId(document, payload.nodeIds);
    const nonCube = findNonCube(document, payload.nodeIds);
    if (
      missingId ||
      nonCube ||
      (payload.textureId !== null && !document.textures[payload.textureId])
    ) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: missingId
            ? `Scene node "${missingId}" does not exist.`
            : nonCube
              ? `Scene node "${nonCube.id}" is not a cube.`
              : `Texture "${payload.textureId}" does not exist.`,
          path: missingId || nonCube ? 'payload.nodeIds' : 'payload.textureId'
        }
      };
    }
    const next = payload.nodeIds.reduce(
      (current, nodeId) =>
        updateSceneNode(current, nodeId, (node) => {
          if (node.kind !== 'cube') return node;
          return {
            ...node,
            ...(payload.shade === undefined ? {} : { shade: payload.shade }),
            ...(payload.lightEmission === undefined
              ? {}
              : { lightEmission: payload.lightEmission }),
            faces: Object.fromEntries(
              CUBE_FACE_DIRECTIONS.map((direction) => [
                direction,
                {
                  ...node.faces[direction],
                  textureId: payload.textureId
                }
              ])
            ) as typeof node.faces
          };
        }),
      document
    );
    return {
      ok: true,
      value: {
        document: next,
        summary: `Set material on ${payload.nodeIds.length} cube${payload.nodeIds.length === 1 ? '' : 's'}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: payload.nodeIds,
          removedEntityIds: [],
          invalidated: ['scene', 'textures', 'validation', 'preview']
        }
      }
    };
  }
});
