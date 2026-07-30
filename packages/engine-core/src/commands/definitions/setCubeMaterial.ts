import { CUBE_FACE_DIRECTIONS } from '../../model';
import { updateSceneNode } from '../../scene';
import {
  createTextureAsset,
  implicitTextureId
} from '../../textures/createTextureAsset';
import { defineCommand } from '../definition';
import { colorSchema, entityIdsSchema } from './schemas';
import {
  findMissingNodeId,
  findNonCube
} from './sceneHelpers';

const inputSchema = {
  type: 'object',
  properties: {
    nodeIds: entityIdsSchema,
    baseColor: colorSchema
  },
  required: ['nodeIds', 'baseColor'],
  additionalProperties: false
} as const;

export const setCubeMaterialCommand = defineCommand({
  name: 'scene.cubes.material',
  label: 'Set cube material',
  purpose:
    'Set one base color; ashfox derives fixed Minecraft face shades.',
  inputSchema,
  apply: (document, payload) => {
    const missingId = findMissingNodeId(document, payload.nodeIds);
    const nonCube = findNonCube(document, payload.nodeIds);
    if (missingId || nonCube || !/^#[0-9a-fA-F]{6}$/.test(payload.baseColor)) {
      return {
        ok: false,
        error: {
          code: missingId || nonCube ? 'invalid_state' : 'invalid_payload',
          message: missingId
            ? `Scene node "${missingId}" does not exist.`
            : nonCube
              ? `Scene node "${nonCube.id}" is not a cube.`
              : 'Material base color must use six-digit hex.',
          path: missingId || nonCube
            ? 'payload.nodeIds'
            : 'payload.baseColor',
          expected: missingId || nonCube ? 'existing cube IDs' : '#RRGGBB'
        }
      };
    }

    const generatedTexture = Object.values(document.textures)
      .filter((texture) => texture.atlasMode === 'generate')
      .sort((left, right) => left.id.localeCompare(right.id))[0];
    const implicitTexture = generatedTexture
      ? null
      : createTextureAsset(document, {
          id: implicitTextureId(document),
          name: 'Base texture'
        });
    const textureId = generatedTexture?.id ?? implicitTexture?.id;
    if (!textureId) throw new Error('Generated texture setup failed.');
    const prepared = implicitTexture
      ? {
          ...document,
          textures: {
            ...document.textures,
            [implicitTexture.id]: implicitTexture
          }
        }
      : document;
    const next = payload.nodeIds.reduce(
      (current, nodeId) =>
        updateSceneNode(current, nodeId, (node) => {
          if (node.kind !== 'cube') return node;
          const alreadyAssigned =
            node.baseColor.toLowerCase() === payload.baseColor.toLowerCase() &&
            CUBE_FACE_DIRECTIONS.every(
              (direction) =>
                node.faces[direction].textureId === textureId &&
                (node.faces[direction].rotation ?? 0) === 0
            ) &&
            !node.boxUv &&
            node.uvOffset === undefined;
          if (alreadyAssigned) return node;
          return {
            ...node,
            baseColor: payload.baseColor,
            boxUv: false,
            uvOffset: undefined,
            faces: Object.fromEntries(
              CUBE_FACE_DIRECTIONS.map((direction) => [
                direction,
                {
                  ...node.faces[direction],
                  textureId,
                  rotation: 0
                }
              ])
            ) as typeof node.faces
          };
        }),
      prepared
    );
    return {
      ok: true,
      value: {
        document: next,
        summary:
          `Set ${payload.baseColor} material on ` +
          `${payload.nodeIds.length} cube` +
          `${payload.nodeIds.length === 1 ? '' : 's'}`,
        effects: {
          createdEntityIds: implicitTexture ? [implicitTexture.id] : [],
          changedEntityIds: payload.nodeIds,
          removedEntityIds: [],
          invalidated:
            next === document
              ? []
              : ['scene', 'textures', 'uv', 'validation', 'preview']
        }
      }
    };
  }
});
