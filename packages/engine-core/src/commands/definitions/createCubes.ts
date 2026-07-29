import {
  CUBE_FACE_DIRECTIONS,
  IDENTITY_TRANSFORM,
  type CubeFace,
  type CubeFaces,
  type CubeNode,
  type ProjectDocument
} from '../../model';
import { addSceneNode } from '../../scene';
import {
  createTextureAsset,
  implicitTextureId
} from '../../textures/createTextureAsset';
import { defineCommand } from '../definition';
import {
  nullableEntityIdSchema,
  partialTransformSchema,
  uvRectSchema,
  vec2Schema,
  vec3Schema
} from './schemas';
import type { CubeCreateInput } from '../types';

const cubeSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      minLength: 1
    },
    name: {
      type: 'string',
      minLength: 1
    },
    parentId: nullableEntityIdSchema,
    bounds: {
      type: 'object',
      properties: {
        from: vec3Schema,
        to: vec3Schema
      },
      required: ['from', 'to'],
      additionalProperties: false
    },
    transform: partialTransformSchema,
    textureId: nullableEntityIdSchema,
    faceUv: uvRectSchema,
    inflate: {
      type: 'number'
    },
    mirror: {
      type: 'boolean'
    },
    boxUv: {
      type: 'boolean'
    },
    uvOffset: vec2Schema,
    shade: {
      type: 'boolean'
    }
  },
  required: ['id', 'name', 'parentId', 'bounds'],
  additionalProperties: false
} as const;

const inputSchema = {
  type: 'object',
  properties: {
    cubes: {
      type: 'array',
      items: cubeSchema,
      minItems: 1,
      maxItems: 128
    }
  },
  required: ['cubes'],
  additionalProperties: false
} as const;

const createFaces = (
  textureId: string | null,
  uv: readonly [number, number, number, number]
): CubeFaces =>
  Object.fromEntries(
    CUBE_FACE_DIRECTIONS.map((direction) => {
      const face: CubeFace = {
        enabled: true,
        textureId,
        uv,
        rotation: 0
      };
      return [direction, face];
    })
  ) as CubeFaces;

const createCubeNode = (
  document: ProjectDocument,
  input: CubeCreateInput
): CubeNode => {
  const textureId =
    input.textureId === undefined
      ? Object.keys(document.textures)[0] ?? null
      : input.textureId;
  const faceUv = input.faceUv ?? [
    0,
    0,
    document.settings.textureResolution.width,
    document.settings.textureResolution.height
  ];
  return {
    id: input.id,
    kind: 'cube',
    name: input.name,
    parentId: input.parentId,
    transform: {
      ...IDENTITY_TRANSFORM,
      ...input.transform
    },
    visible: true,
    bounds: input.bounds,
    inflate: input.inflate ?? 0,
    mirror: input.mirror ?? false,
    boxUv: input.boxUv ?? false,
    ...(input.uvOffset ? { uvOffset: input.uvOffset } : {}),
    ...(input.shade === undefined ? {} : { shade: input.shade }),
    faces: createFaces(textureId, faceUv)
  };
};

const findInvalidParent = (
  document: ProjectDocument,
  inputs: readonly CubeCreateInput[]
): CubeCreateInput | undefined =>
  inputs.find((input) => {
    if (input.parentId === null) return false;
    return document.scene.nodes[input.parentId]?.kind !== 'bone';
  });

const addCubeToScene = (
  document: ProjectDocument,
  input: CubeCreateInput
): ProjectDocument => {
  const next = addSceneNode(document, createCubeNode(document, input));
  if (input.parentId !== null) return next;
  return {
    ...next,
    scene: {
      ...next.scene,
      roots: [...next.scene.roots, input.id]
    }
  };
};

export const createCubesCommand = defineCommand({
  name: 'scene.cubes.create',
  label: 'Create cubes',
  purpose:
    'Create cube primitives; omitted textureId reuses a texture or creates one generate-mode base texture, while null stays untextured.',
  inputSchema,
  apply: (document, payload) => {
    const ids = payload.cubes.map((cube) => cube.id);
    const duplicateId = ids.find(
      (id, index) =>
        ids.indexOf(id) !== index || document.scene.nodes[id] !== undefined
    );
    if (duplicateId) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: `Scene node ID "${duplicateId}" is already in use.`,
          path: 'payload.cubes'
        }
      };
    }

    const missingTexture = payload.cubes.find(
      (cube) =>
        typeof cube.textureId === 'string' &&
        document.textures[cube.textureId] === undefined
    );
    if (missingTexture) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message:
            `Texture "${missingTexture.textureId}" does not exist.`,
          path: `payload.cubes.${missingTexture.id}.textureId`,
          expected: 'existing texture ID, null, or omitted textureId'
        }
      };
    }

    const invalidParent = findInvalidParent(document, payload.cubes);
    if (invalidParent) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: 'Cube parent must reference an existing bone.',
          path: `payload.cubes.${invalidParent.id}.parentId`,
          expected: 'existing bone ID or null'
        }
      };
    }

    const shouldCreateTexture =
      Object.keys(document.textures).length === 0 &&
      payload.cubes.some((cube) => cube.textureId === undefined);
    const implicitTexture = shouldCreateTexture
      ? createTextureAsset(document, {
          id: implicitTextureId(document),
          name: 'Base texture'
        })
      : null;
    const prepared = implicitTexture
      ? {
          ...document,
          textures: {
            ...document.textures,
            [implicitTexture.id]: implicitTexture
          }
        }
      : document;
    const next = payload.cubes.reduce(
      (current, input) => addCubeToScene(current, input),
      prepared
    );
    return {
      ok: true,
      value: {
        document: next,
        summary:
          payload.cubes.length === 1
            ? `Create ${payload.cubes[0].name}`
            : `Create ${payload.cubes.length} cubes`,
        effects: {
          createdEntityIds: implicitTexture
            ? [implicitTexture.id, ...ids]
            : ids,
          changedEntityIds: [],
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
