import {
  CUBE_FACE_DIRECTIONS,
  type CubeFace,
  type CubeFaces,
  type CubeNode,
  type ProjectDocument
} from '../model';
import { compareStableText } from '../stableOrder';
import {
  createTextureAsset,
  implicitTextureId
} from './createTextureAsset';

export interface GeneratedTextureSetup {
  document: ProjectDocument;
  textureId: string;
  createdTextureId: string | null;
}

export const ensureGeneratedTexture = (
  document: ProjectDocument
): GeneratedTextureSetup => {
  const existing = Object.values(document.textures)
    .filter((texture) => texture.atlasMode === 'generate')
    .sort((left, right) => compareStableText(left.id, right.id))[0];
  if (existing) {
    return {
      document,
      textureId: existing.id,
      createdTextureId: null
    };
  }
  const texture = createTextureAsset(document, {
    id: implicitTextureId(document),
    name: 'Base texture'
  });
  return {
    document: {
      ...document,
      textures: {
        ...document.textures,
        [texture.id]: texture
      }
    },
    textureId: texture.id,
    createdTextureId: texture.id
  };
};

export const createGeneratedCubeFaces = (
  textureId: string,
  width: number,
  height: number
): CubeFaces =>
  Object.fromEntries(
    CUBE_FACE_DIRECTIONS.map((direction) => {
      const face: CubeFace = {
        enabled: true,
        textureId,
        uv: [0, 0, width, height],
        rotation: 0
      };
      return [direction, face];
    })
  ) as CubeFaces;

export const applyGeneratedCubeMaterial = (
  cube: CubeNode,
  textureId: string,
  baseColor: string
): CubeNode => ({
  ...cube,
  baseColor,
  boxUv: false,
  uvOffset: undefined,
  faces: Object.fromEntries(
    CUBE_FACE_DIRECTIONS.map((direction) => [
      direction,
      {
        ...cube.faces[direction],
        textureId,
        rotation: 0
      }
    ])
  ) as CubeFaces
});
