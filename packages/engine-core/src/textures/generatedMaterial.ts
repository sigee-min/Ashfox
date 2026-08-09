import {
  CUBE_FACE_DIRECTIONS,
  type CubeFace,
  type CubeFaces,
  type ProjectDocument
} from '../model';
import { compareStableText } from '../stableOrder';
import {
  createTextureAsset,
  implicitTextureId
} from './createTextureAsset';
import { SURFACE_SYNTHESIS_VERSION } from './appearance';

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
    const versioned = existing.metadata?.surfaceSynthesisVersion ===
      SURFACE_SYNTHESIS_VERSION
      ? document
      : {
          ...document,
          textures: {
            ...document.textures,
            [existing.id]: {
              ...existing,
              metadata: {
                ...existing.metadata,
                surfaceSynthesisVersion: SURFACE_SYNTHESIS_VERSION
              }
            }
          }
        };
    return {
      document: versioned,
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
