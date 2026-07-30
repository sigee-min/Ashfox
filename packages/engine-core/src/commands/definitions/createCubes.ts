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
  colorSchema,
  nullableEntityIdSchema,
  partialTransformSchema,
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
    baseColor: colorSchema,
    inflate: {
      type: 'number'
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
  input: CubeCreateInput,
  textureId: string
): CubeNode => {
  const texture = document.textures[textureId];
  const defaultUv: readonly [number, number, number, number] = [
    0,
    0,
    texture.width,
    texture.height
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
    mirror: false,
    boxUv: false,
    baseColor: input.baseColor ?? '#8e98a3',
    faces: createFaces(textureId, defaultUv)
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
  input: CubeCreateInput,
  textureId: string
): ProjectDocument => {
  const next = addSceneNode(
    document,
    createCubeNode(document, input, textureId)
  );
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
    'Create textured cube primitives from one base color per material.',
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

    const invalidColor = payload.cubes.find(
      (cube) =>
        cube.baseColor !== undefined &&
        !/^#[0-9a-fA-F]{6}$/.test(cube.baseColor)
    );
    if (invalidColor) {
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message: 'Cube base colors must use six-digit hex colors.',
          path: `payload.cubes.${invalidColor.id}.baseColor`,
          expected: '#RRGGBB'
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

    const generatedTexture = Object.values(document.textures)
      .filter((texture) => texture.atlasMode === 'generate')
      .sort((left, right) => left.id.localeCompare(right.id))[0];
    const shouldCreateTexture = generatedTexture === undefined;
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
    const textureId = generatedTexture?.id ?? implicitTexture?.id;
    if (!textureId) {
      throw new Error('Generated texture setup failed.');
    }
    const next = payload.cubes.reduce(
      (current, input) => addCubeToScene(current, input, textureId),
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
