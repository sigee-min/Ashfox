import { CUBE_FACE_DIRECTIONS } from '../../model';
import { updateSceneNode } from '../../scene';
import { defineCommand } from '../definition';
import { entityIdsSchema } from './schemas';
import {
  findMissingNodeId,
  findNonCube
} from './sceneHelpers';

const inputSchema = {
  type: 'object',
  properties: {
    nodeIds: entityIdsSchema,
    padding: {
      type: 'number',
      minimum: 0
    }
  },
  required: ['nodeIds', 'padding'],
  additionalProperties: false
} as const;

export const fitCubeUvCommand = defineCommand({
  name: 'scene.cubes.uv.fit',
  label: 'Fit cube UV',
  purpose: 'Fit enabled cube faces inside the project texture bounds.',
  inputSchema,
  apply: (document, payload) => {
    const missingId = findMissingNodeId(document, payload.nodeIds);
    const nonCube = findNonCube(document, payload.nodeIds);
    const width = document.settings.textureResolution.width;
    const height = document.settings.textureResolution.height;
    if (
      missingId ||
      nonCube ||
      payload.padding * 2 >= Math.min(width, height)
    ) {
      return {
        ok: false,
        error: {
          code: missingId || nonCube ? 'invalid_state' : 'invalid_payload',
          message: missingId
            ? `Scene node "${missingId}" does not exist.`
            : nonCube
              ? `Scene node "${nonCube.id}" is not a cube.`
              : 'UV padding leaves no writable texture area.',
          path: missingId || nonCube ? 'payload.nodeIds' : 'payload.padding'
        }
      };
    }
    const uv = [
      payload.padding,
      payload.padding,
      width - payload.padding,
      height - payload.padding
    ] as const;
    const next = payload.nodeIds.reduce(
      (current, nodeId) =>
        updateSceneNode(current, nodeId, (node) => {
          if (node.kind !== 'cube') return node;
          return {
            ...node,
            boxUv: false,
            faces: Object.fromEntries(
              CUBE_FACE_DIRECTIONS.map((direction) => [
                direction,
                {
                  ...node.faces[direction],
                  uv
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
        summary: `Fit UV for ${payload.nodeIds.length} cube${payload.nodeIds.length === 1 ? '' : 's'}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: payload.nodeIds,
          removedEntityIds: [],
          invalidated: ['scene', 'textures', 'uv', 'validation', 'preview']
        }
      }
    };
  }
});
