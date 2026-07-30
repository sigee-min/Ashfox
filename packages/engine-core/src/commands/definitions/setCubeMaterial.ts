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
    const targetTexture = payload.textureId === null
      ? null
      : document.textures[payload.textureId];
    const detailedNode = payload.nodeIds.find((nodeId) => {
      const node = document.scene.nodes[nodeId];
      return (
        node.kind === 'cube' &&
        CUBE_FACE_DIRECTIONS.some(
          (direction) => node.faces[direction].details.length > 0
        )
      );
    });
    if (detailedNode && targetTexture?.atlasMode !== 'generate') {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message:
            `Cube "${detailedNode}" owns generated surface details. ` +
            'Remove those details before assigning no texture or a ' +
            'preserved texture.',
          path: 'payload.textureId',
          expected: 'generate-mode texture'
        }
      };
    }
    const next = payload.nodeIds.reduce(
      (current, nodeId) =>
        updateSceneNode(current, nodeId, (node) => {
          if (node.kind !== 'cube') return node;
          const preserveUv = targetTexture?.atlasMode === 'preserve'
            ? [
                0,
                0,
                targetTexture.width,
                targetTexture.height
              ] as const
            : null;
          return {
            ...node,
            ...(preserveUv
              ? {
                  boxUv: false,
                  mirror: false,
                  uvOffset: undefined
                }
              : {}),
            ...(payload.shade === undefined ? {} : { shade: payload.shade }),
            ...(payload.lightEmission === undefined
              ? {}
              : { lightEmission: payload.lightEmission }),
            faces: Object.fromEntries(
              CUBE_FACE_DIRECTIONS.map((direction) => [
                direction,
                {
                  ...node.faces[direction],
                  textureId: payload.textureId,
                  ...(preserveUv
                    ? {
                        uv: preserveUv,
                        rotation: 0
                      }
                    : {})
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
          invalidated: [
            'scene',
            'textures',
            'uv',
            'validation',
            'preview'
          ]
        }
      }
    };
  }
});
