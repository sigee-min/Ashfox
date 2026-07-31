import {
  CUBE_FACE_DIRECTIONS,
  type ProjectDocument
} from '../../model';
import {
  generatedSurfaceFaceKey,
  type CompiledSurfaceAuthority
} from '../generatedSurfaceAuthority';
import type { UvAtlasPlacement } from '../uvAtlas';
import type { AtlasPlan, FaceTarget } from './types';

const expectedUv = (
  placement: UvAtlasPlacement<FaceTarget>
): readonly [number, number, number, number] => [
  placement.x,
  placement.y,
  placement.x + placement.width,
  placement.y + placement.height
];

const uvMatches = (
  actual: readonly number[] | undefined,
  expected: readonly number[]
): boolean =>
  actual?.length === expected.length &&
  actual.every((value, index) => value === expected[index]);

export const generatedNodeMatchesPlan = (
  document: ProjectDocument,
  nodeId: string,
  placements: readonly UvAtlasPlacement<FaceTarget>[],
  authority: CompiledSurfaceAuthority
): boolean => {
  const node = document.scene.nodes[nodeId];
  if (
    node?.kind !== 'cube' ||
    node.boxUv ||
    node.uvOffset !== undefined
  ) {
    return false;
  }
  const placementsByDirection = new Map(
    placements.map((placement) => [
      placement.value.direction,
      placement
    ])
  );
  return CUBE_FACE_DIRECTIONS.every((direction) => {
    const face = node.faces[direction];
    const compiledFace = authority.faces.get(
      generatedSurfaceFaceKey(nodeId, direction)
    );
    if (compiledFace && face.enabled !== compiledFace.external) {
      return false;
    }
    const placement = placementsByDirection.get(direction);
    if (!placement) return true;
    return (
      face.enabled &&
      face.rotation === 0 &&
      uvMatches(face.uv, expectedUv(placement))
    );
  });
};

export const generatedTextureMatchesPlan = (
  document: ProjectDocument,
  textureId: string,
  plan: AtlasPlan,
  authority: CompiledSurfaceAuthority
): boolean => {
  const texture = document.textures[textureId];
  const placements = plan.placementsByTexture.get(textureId);
  if (
    texture?.atlasMode !== 'generate' ||
    !placements ||
    !texture.raster ||
    texture.raster.canvasDetails.length !== 0 ||
    texture.width !== plan.width ||
    texture.height !== plan.height
  ) {
    return false;
  }
  const byNode = new Map<string, UvAtlasPlacement<FaceTarget>[]>();
  for (const placement of placements) {
    const nodePlacements = byNode.get(placement.value.nodeId) ?? [];
    nodePlacements.push(placement);
    byNode.set(placement.value.nodeId, nodePlacements);
  }
  const nodeIds = new Set([
    ...byNode.keys(),
    ...authority.nodeIds
  ]);
  return [...nodeIds].every((nodeId) =>
    generatedNodeMatchesPlan(
      document,
      nodeId,
      byNode.get(nodeId) ?? [],
      authority
    )
  );
};

export const textureSettingsMatchPlan = (
  document: ProjectDocument,
  plan: AtlasPlan
): boolean =>
  document.settings.textureResolution.width === plan.width &&
  document.settings.textureResolution.height === plan.height;
