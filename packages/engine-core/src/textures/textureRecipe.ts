export { composeTextureRaster } from './textureRecipe/composition';
export { deriveGeneratedTextures } from './textureRecipe/derive';
export {
  generatedTextureMatchesDerivation,
  staleGeneratedTextureIds
} from './textureRecipe/derivationStatus';
export {
  GENERATED_ATLAS_MAX_RESOLUTION,
  GENERATED_ATLAS_MIN_RESOLUTION,
  hasTextureSurfaceArea
} from './textureRecipe/surfaceMetrics';
export type {
  TextureComposition,
  TextureCompositionRegion,
  TextureDerivationFailure,
  TextureDerivationResult,
  TextureDerivationSuccess
} from './textureRecipe/types';
export type {
  GeneratedSurfaceMarking,
  GeneratedSurfacePattern
} from './generatedSurfaceAuthority';
