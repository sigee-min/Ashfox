import {
  CUBE_FACE_DIRECTIONS,
  type CubeFaceDirection,
  type ProjectDocument
} from '../../model';
import {
  effectiveGeneratedFaceEnabled,
  generatedSurfaceFaceKey,
  type CompiledSurfaceAuthority
} from '../appearance/authority';
import {
  packUvAtlasWithGutter,
  type UvAtlasPlacement,
  type UvAtlasRect
} from '../uvAtlas';
import {
  exactGeneratedTexelSize,
  GENERATED_ATLAS_MAX_RESOLUTION,
  GENERATED_ATLAS_MIN_RESOLUTION,
  generatedTextureGutter,
  hasTextureSurfaceArea
} from './surfaceMetrics';
import type { AtlasPlan, FaceTarget } from './types';

export const activeGeneratedTextureIds = (
  document: ProjectDocument,
  authority: CompiledSurfaceAuthority
): readonly string[] =>
  [...new Set(
    Object.values(document.scene.nodes).flatMap((node) => {
      if (node.kind !== 'cube') return [];
      return CUBE_FACE_DIRECTIONS.flatMap((direction) => {
        const face = node.faces[direction];
        const textureId = face.textureId;
        return (
          effectiveGeneratedFaceEnabled(node, direction, authority) &&
          textureId !== null &&
          document.textures[textureId]?.atlasMode === 'generate'
        )
          ? [textureId]
          : [];
      });
    })
  )].sort();

export const invalidGeneratedGridFace = (
  document: ProjectDocument,
  authority: CompiledSurfaceAuthority
): { nodeId: string; direction: CubeFaceDirection } | null => {
  for (const node of Object.values(document.scene.nodes)) {
    if (node.kind !== 'cube') continue;
    for (const direction of CUBE_FACE_DIRECTIONS) {
      const face = node.faces[direction];
      if (
        effectiveGeneratedFaceEnabled(node, direction, authority) &&
        face.textureId !== null &&
        document.textures[face.textureId]?.atlasMode === 'generate' &&
        hasTextureSurfaceArea(node, direction) &&
        !exactGeneratedTexelSize(document, node, direction)
      ) {
        return { nodeId: node.id, direction };
      }
    }
  }
  return null;
};

const collectRects = (
  document: ProjectDocument,
  authority: CompiledSurfaceAuthority
): Map<string, UvAtlasRect<FaceTarget>[]> | null => {
  const byTexture = new Map<string, UvAtlasRect<FaceTarget>[]>();
  for (const node of Object.values(document.scene.nodes)) {
    if (node.kind !== 'cube') continue;
    for (const direction of CUBE_FACE_DIRECTIONS) {
      const face = node.faces[direction];
      if (
        !effectiveGeneratedFaceEnabled(node, direction, authority) ||
        face.textureId === null
      ) {
        continue;
      }
      const texture = document.textures[face.textureId];
      if (texture?.atlasMode !== 'generate') continue;
      const size = exactGeneratedTexelSize(document, node, direction);
      if (!size) return null;
      const compiledFace = authority.faces.get(
        generatedSurfaceFaceKey(node.id, direction)
      );
      const rects = byTexture.get(texture.id) ?? [];
      rects.push({
        key: `${node.id}:${direction}`,
        width: size.width,
        height: size.height,
        value: {
          nodeId: node.id,
          direction,
          textureId: texture.id,
          ...(compiledFace?.pattern
            ? { pattern: compiledFace.pattern }
            : {}),
          ...(compiledFace?.markings?.length
            ? { markings: compiledFace.markings }
            : {})
        }
      });
      byTexture.set(texture.id, rects);
    }
  }
  return byTexture;
};

const tryResolution = (
  document: ProjectDocument,
  rectsByTexture: ReadonlyMap<
    string,
    readonly UvAtlasRect<FaceTarget>[]
  >,
  resolution: number
): Map<string, UvAtlasPlacement<FaceTarget>[]> | null => {
  const placements = new Map<string, UvAtlasPlacement<FaceTarget>[]>();
  for (const [textureId, rects] of rectsByTexture) {
    const packed = packUvAtlasWithGutter(
      rects,
      resolution,
      resolution,
      generatedTextureGutter(document)
    );
    if (!packed) return null;
    placements.set(textureId, packed);
  }
  return placements;
};

export const buildGeneratedAtlasPlan = (
  document: ProjectDocument,
  authority: CompiledSurfaceAuthority
): AtlasPlan | null => {
  const rects = collectRects(document, authority);
  if (!rects || rects.size === 0) return null;
  for (
    let resolution = GENERATED_ATLAS_MIN_RESOLUTION;
    resolution <= GENERATED_ATLAS_MAX_RESOLUTION;
    resolution *= 2
  ) {
    const placements = tryResolution(document, rects, resolution);
    if (placements) {
      return {
        width: resolution,
        height: resolution,
        placementsByTexture: placements
      };
    }
  }
  return null;
};

export const atlasUvAssignments = (
  plan: AtlasPlan
): ReadonlyMap<string, readonly [number, number, number, number]> => {
  const assignment = new Map<
    string,
    readonly [number, number, number, number]
  >();
  for (const placements of plan.placementsByTexture.values()) {
    for (const placement of placements) {
      assignment.set(placement.key, [
        placement.x,
        placement.y,
        placement.x + placement.width,
        placement.y + placement.height
      ]);
    }
  }
  return assignment;
};
