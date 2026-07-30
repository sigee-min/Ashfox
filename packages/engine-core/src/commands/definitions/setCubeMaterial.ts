import { updateSceneNode } from '../../scene';
import { defineCommand } from '../definition';
import { colorSchema, entityIdsSchema } from './schemas';
import {
  applyGeneratedCubeMaterial,
  ensureGeneratedTexture
} from '../../textures/generatedMaterial';
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
    'Set one base color; ashfox derives deterministic directional pixel tones.',
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

    const setup = ensureGeneratedTexture(document);
    const next = payload.nodeIds.reduce(
      (current, nodeId) =>
        updateSceneNode(current, nodeId, (node) => {
          if (node.kind !== 'cube') return node;
          const alreadyAssigned =
            node.baseColor.toLowerCase() === payload.baseColor.toLowerCase() &&
            Object.values(node.faces).every(
              (direction) =>
                direction.textureId === setup.textureId &&
                (direction.rotation ?? 0) === 0
            ) &&
            !node.boxUv &&
            node.uvOffset === undefined;
          if (alreadyAssigned) return node;
          return applyGeneratedCubeMaterial(
            node,
            setup.textureId,
            payload.baseColor
          );
        }),
      setup.document
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
          createdEntityIds: setup.createdTextureId
            ? [setup.createdTextureId]
            : [],
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
