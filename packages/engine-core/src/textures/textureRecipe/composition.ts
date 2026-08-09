import {
  CUBE_FACE_DIRECTIONS,
  type ProjectDocument,
  type TextureAsset
} from '../../model';
import {
  effectiveGeneratedFaceEnabled,
  generatedSurfaceFaceKey
} from '../generatedSurfaceAuthority';
import {
  compileTextureSurfaceAuthority,
  generatedTextureBaseColor,
  generatedTextureGutter,
  hasTextureSurfaceArea
} from './surfaceMetrics';
import type {
  TextureComposition,
  TextureCompositionRegion
} from './types';

export const composeTextureRaster = (
  document: ProjectDocument,
  texture: TextureAsset
): TextureComposition => {
  const generated = texture.atlasMode === 'generate';
  const authority = compileTextureSurfaceAuthority(document);
  const regions: TextureCompositionRegion[] = [];
  if (generated) {
    for (const node of Object.values(document.scene.nodes)) {
      if (node.kind !== 'cube') continue;
      for (const face of CUBE_FACE_DIRECTIONS) {
        const surface = node.faces[face];
        const uv = surface.uv;
        if (
          !effectiveGeneratedFaceEnabled(node, face, authority) ||
          surface.textureId !== texture.id ||
          !uv ||
          !hasTextureSurfaceArea(node, face)
        ) {
          continue;
        }
        const compiledFace = authority.faces.get(
          generatedSurfaceFaceKey(node.id, face)
        );
        regions.push({
          nodeId: node.id,
          face,
          tonePolicy: compiledFace?.tonePolicy ?? 'regular',
          x: uv[0],
          y: uv[1],
          width: uv[2] - uv[0],
          height: uv[3] - uv[1],
          color: node.baseColor,
          ...(compiledFace?.pattern
            ? { pattern: compiledFace.pattern }
            : {}),
          ...(compiledFace?.markings?.length
            ? { markings: compiledFace.markings }
            : {})
        });
      }
    }
  }
  return {
    background: generatedTextureBaseColor(texture),
    generated,
    gutter: generated ? generatedTextureGutter(document) : 0,
    regions,
    canvasDetails: texture.raster?.canvasDetails ?? []
  };
};
