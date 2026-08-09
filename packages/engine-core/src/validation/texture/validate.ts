import {
  CUBE_FACE_DIRECTIONS,
  type ProjectDocument
} from '../../model';
import { staleGeneratedTextureIds } from '../../textures/textureRecipe';
import {
  SURFACE_SYNTHESIS_VERSION
} from '../../textures/appearance';
import {
  GENERATED_ATLAS_MAX_RESOLUTION
} from '../../textures/textureRecipe/surfaceMetrics';
import {
  COLOR_PATTERN,
  isNonEmptyString,
  isSafeBlobBucket,
  isSafeBlobKey
} from '../shared/value';
import type {
  FindingSink,
  IdRegistrar
} from '../contract';

const validateTextureRaster = (
  texture: ProjectDocument['textures'][string],
  path: string,
  add: FindingSink,
  registerId: IdRegistrar
): void => {
  if (!texture.raster) return;
  const canvasDetails = texture.raster.canvasDetails;
  const invalidCanvas =
    !Array.isArray(canvasDetails) ||
    canvasDetails.length > 512 ||
    canvasDetails.some((detail, index) => {
      registerId(detail.id, `${path}.raster.canvasDetails.${index}`);
      return (
        texture.atlasMode === 'generate' ||
        !COLOR_PATTERN.test(detail.color) ||
        !Number.isInteger(detail.x) ||
        !Number.isInteger(detail.y) ||
        !Number.isInteger(detail.width) ||
        !Number.isInteger(detail.height) ||
        detail.x < 0 ||
        detail.y < 0 ||
        detail.width <= 0 ||
        detail.height <= 0 ||
        detail.x + detail.width > texture.width ||
        detail.y + detail.height > texture.height
      );
    });
  if (!COLOR_PATTERN.test(texture.raster.background) || invalidCanvas) {
    add({
      code: 'texture.invalid_raster',
      severity: 'error',
      message:
        'Texture raster colors and canvas details must match their ' +
        'atlas mode and dimensions.',
      path: `${path}.raster`,
      assetIds: [texture.id]
    });
  }
};

const usesGeneratedTexture = (
  document: ProjectDocument,
  textureId: string
): boolean =>
  Object.values(document.scene.nodes).some(
    (node) =>
      node.kind === 'cube' &&
      CUBE_FACE_DIRECTIONS.some(
        (direction) =>
          node.faces[direction].enabled &&
          node.faces[direction].textureId === textureId
      )
  );

export const validateTextures = (
  document: ProjectDocument,
  add: FindingSink,
  registerId: IdRegistrar
): void => {
  const staleTextureIds = staleGeneratedTextureIds(document);
  for (const [assetKey, texture] of Object.entries(document.textures)) {
    const path = `textures.${assetKey}`;
    registerId(texture.id, path);
    if (assetKey !== texture.id) {
      add({
        code: 'identity.key_mismatch',
        severity: 'error',
        message: `Texture map key "${assetKey}" does not match ID "${texture.id}".`,
        path,
        assetIds: [texture.id]
      });
    }
    if (
      !Number.isInteger(texture.width) ||
      texture.width <= 0 ||
      texture.width > GENERATED_ATLAS_MAX_RESOLUTION ||
      !Number.isInteger(texture.height) ||
      texture.height <= 0 ||
      texture.height > GENERATED_ATLAS_MAX_RESOLUTION
    ) {
      add({
        code: 'texture.invalid_dimensions',
        severity: 'error',
        message:
          'Texture dimensions must be positive integers no larger than ' +
          `${GENERATED_ATLAS_MAX_RESOLUTION}.`,
        path,
        assetIds: [texture.id]
      });
    }
    if (
      texture.atlasMode !== undefined &&
      texture.atlasMode !== 'generate' &&
      texture.atlasMode !== 'preserve'
    ) {
      add({
        code: 'texture.invalid_atlas_mode',
        severity: 'error',
        message: 'Texture atlas mode must be generate or preserve.',
        path: `${path}.atlasMode`,
        assetIds: [texture.id]
      });
    }
    if (
      texture.atlasMode === 'generate' &&
      texture.metadata?.surfaceSynthesisVersion !==
        SURFACE_SYNTHESIS_VERSION
    ) {
      add({
        code: 'texture.invalid_surface_synthesis_version',
        severity: 'error',
        message:
          'Generated textures require the current closed surface synthesis version.',
        path: `${path}.metadata.surfaceSynthesisVersion`,
        assetIds: [texture.id]
      });
    }
    if (
      !isNonEmptyString(texture.source.bucket) ||
      !isNonEmptyString(texture.source.key) ||
      !isNonEmptyString(texture.source.contentType) ||
      !isNonEmptyString(texture.source.contentHash) ||
      (isNonEmptyString(texture.source.bucket) &&
        !isSafeBlobBucket(texture.source.bucket)) ||
      (isNonEmptyString(texture.source.key) &&
        !isSafeBlobKey(texture.source.key)) ||
      (texture.source.byteLength !== undefined &&
        (!Number.isInteger(texture.source.byteLength) ||
          texture.source.byteLength < 0))
    ) {
      add({
        code: 'texture.invalid_blob',
        severity: 'error',
        message: 'Texture blob references require safe logical bucket/key values, contentType, contentHash, and a non-negative byteLength.',
        path: `${path}.source`,
        assetIds: [texture.id]
      });
    }
    validateTextureRaster(texture, path, add, registerId);
    if (
      texture.atlasMode === 'generate' &&
      usesGeneratedTexture(document, texture.id) &&
      staleTextureIds.has(texture.id)
    ) {
      add({
        code: 'texture.recipe_stale',
        severity: 'warning',
        message: 'Generated texture does not match its canonical derivation.',
        path: 'settings.textureResolution',
        assetIds: [texture.id]
      });
    }
  }
};
