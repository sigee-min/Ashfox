import {
  CUBE_FACE_DIRECTIONS,
  type CubeNode,
  type ProjectDocument
} from '../../model';
import { updateSceneNode } from '../../scene';
import {
  generatedSurfaceFaceKey,
  type CompiledSurfaceAuthority
} from '../appearance/authority';
import type { UvAtlasPlacement } from '../uvAtlas';
import {
  activeGeneratedTextureIds,
  atlasUvAssignments,
  buildGeneratedAtlasPlan,
  invalidGeneratedGridFace
} from './atlasPlan';
import {
  generatedNodeMatchesPlan,
  generatedTextureMatchesPlan,
  textureSettingsMatchPlan
} from './planMatching';
import {
  compileTextureSurfaceAuthority,
  generatedPixelsPerBlock,
  generatedTexelsPerModelUnit,
  generatedTextureBaseColor
} from './surfaceMetrics';
import type {
  AtlasPlan,
  FaceTarget,
  TextureDerivationResult
} from './types';

const mixedBoxUvCube = (
  document: ProjectDocument
): CubeNode | undefined =>
  Object.values(document.scene.nodes).find((node): node is CubeNode => {
    if (node.kind !== 'cube' || !node.boxUv) return false;
    const faces = CUBE_FACE_DIRECTIONS
      .map((direction) => node.faces[direction])
      .filter((face) => face.enabled && face.textureId !== null);
    const hasGenerated = faces.some(
      (face) =>
        document.textures[face.textureId ?? '']?.atlasMode === 'generate'
    );
    const hasPreserved = faces.some(
      (face) =>
        document.textures[face.textureId ?? '']?.atlasMode !== 'generate'
    );
    return hasGenerated && hasPreserved;
  });

const updateGeneratedFaces = (
  document: ProjectDocument,
  plan: AtlasPlan,
  nodeIds: readonly string[],
  authority: CompiledSurfaceAuthority
): ProjectDocument => {
  const assignment = atlasUvAssignments(plan);
  return nodeIds.reduce(
    (current, nodeId) =>
      updateSceneNode(current, nodeId, (node) => {
        if (node.kind !== 'cube') return node;
        const updated: CubeNode = {
          ...node,
          boxUv: false,
          faces: Object.fromEntries(
            CUBE_FACE_DIRECTIONS.map((direction) => {
              const uv = assignment.get(`${nodeId}:${direction}`);
              const compiledFace = authority.faces.get(
                generatedSurfaceFaceKey(nodeId, direction)
              );
              return [
                direction,
                {
                  ...node.faces[direction],
                  ...(compiledFace
                    ? { enabled: compiledFace.external }
                    : {}),
                  ...(uv ? { uv, rotation: 0 } : {})
                }
              ];
            })
          ) as typeof node.faces
        };
        delete updated.uvOffset;
        return updated;
      }),
    document
  );
};

const placementsByNode = (
  plan: AtlasPlan
): ReadonlyMap<string, UvAtlasPlacement<FaceTarget>[]> => {
  const result = new Map<string, UvAtlasPlacement<FaceTarget>[]>();
  for (const placement of plan.placementsByTexture.values()) {
    for (const item of placement) {
      const nodePlacements = result.get(item.value.nodeId) ?? [];
      nodePlacements.push(item);
      result.set(item.value.nodeId, nodePlacements);
    }
  }
  return result;
};

export const deriveGeneratedTextures = (
  document: ProjectDocument
): TextureDerivationResult => {
  const authority = compileTextureSurfaceAuthority(document);
  const generatedTextureIds = activeGeneratedTextureIds(
    document,
    authority
  );
  const metrics = {
    pixelsPerBlock: generatedPixelsPerBlock(document),
    texelsPerModelUnit: generatedTexelsPerModelUnit(document)
  };
  if (generatedTextureIds.length === 0) {
    return {
      ok: true,
      document,
      width: document.settings.textureResolution.width,
      height: document.settings.textureResolution.height,
      ...metrics,
      changedSettings: false,
      changedNodeIds: [],
      changedTextureIds: []
    };
  }
  const mixedCube = mixedBoxUvCube(document);
  if (mixedCube) {
    return {
      ok: false,
      message:
        `Cube "${mixedCube.id}" mixes generated and preserved surfaces.`,
      path: `scene.nodes.${mixedCube.id}.faces`,
      expected: 'one texture mode per cube'
    };
  }
  const invalidFace = invalidGeneratedGridFace(document, authority);
  if (invalidFace) {
    return {
      ok: false,
      message:
        `Cube "${invalidFace.nodeId}" face "${invalidFace.direction}" ` +
        'does not align to the fixed square-pixel grid.',
      path:
        `scene.nodes.${invalidFace.nodeId}.faces.${invalidFace.direction}`,
      expected:
        'bounds, inflate, and scale producing whole texels at the selected surface density'
    };
  }
  const plan = buildGeneratedAtlasPlan(document, authority);
  if (!plan) {
    return {
      ok: false,
      message:
        'Generated surfaces exceed the 4096 × 4096 atlas at the selected surface density.',
      path: 'scene.nodes',
      expected: 'less geometry or a lower surface pixel density'
    };
  }
  const placements = placementsByNode(plan);
  const candidateNodeIds = new Set([
    ...placements.keys(),
    ...authority.nodeIds
  ]);
  const changedNodeIds = [...candidateNodeIds].filter(
    (nodeId) =>
      !generatedNodeMatchesPlan(
        document,
        nodeId,
        placements.get(nodeId) ?? [],
        authority
      )
  );
  const withFaces = updateGeneratedFaces(
    document,
    plan,
    changedNodeIds,
    authority
  );
  const textures = { ...withFaces.textures };
  const changedTextureIds = generatedTextureIds.filter(
    (textureId) =>
      !generatedTextureMatchesPlan(
        document,
        textureId,
        plan,
        authority
      )
  );
  for (const textureId of changedTextureIds) {
    const texture = textures[textureId];
    textures[textureId] = {
      ...texture,
      width: plan.width,
      height: plan.height,
      raster: {
        background: generatedTextureBaseColor(texture),
        canvasDetails: []
      }
    };
  }
  const changedSettings = !textureSettingsMatchPlan(document, plan);
  if (
    !changedSettings &&
    changedNodeIds.length === 0 &&
    changedTextureIds.length === 0
  ) {
    return {
      ok: true,
      document,
      width: plan.width,
      height: plan.height,
      ...metrics,
      changedSettings: false,
      changedNodeIds: [],
      changedTextureIds: []
    };
  }
  return {
    ok: true,
    document: {
      ...withFaces,
      settings: changedSettings
        ? {
            ...withFaces.settings,
            textureResolution: {
              width: plan.width,
              height: plan.height
            }
          }
        : withFaces.settings,
      textures
    },
    width: plan.width,
    height: plan.height,
    ...metrics,
    changedSettings,
    changedNodeIds,
    changedTextureIds
  };
};
