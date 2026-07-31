import {
  CUBE_FACE_DIRECTIONS,
  type CubeFaceDirection,
  type CubeNode,
  type ProjectDocument,
  type TextureAsset,
  type TextureCanvasDetail
} from '../model';
import { updateSceneNode } from '../scene';
import {
  buildCompiledSurfaceAuthority,
  effectiveGeneratedFaceEnabled,
  generatedSurfaceFaceKey,
  type CompiledSurfaceAuthority,
  type GeneratedSurfacePattern
} from './generatedSurfaceAuthority';
import {
  cubeFaceDimensions,
  packUvAtlasWithGutter,
  type UvAtlasPlacement,
  type UvAtlasRect
} from './uvAtlas';

export type {
  GeneratedSurfacePattern
} from './generatedSurfaceAuthority';

const BASE_PIXELS_PER_BLOCK = 16;
export const GENERATED_ATLAS_MIN_RESOLUTION = 16;
export const GENERATED_ATLAS_MAX_RESOLUTION = 4096;

export interface TextureDerivationSuccess {
  ok: true;
  document: ProjectDocument;
  width: number;
  height: number;
  pixelsPerBlock: number;
  texelsPerModelUnit: number;
  changedSettings: boolean;
  changedNodeIds: readonly string[];
  changedTextureIds: readonly string[];
}

export interface TextureDerivationFailure {
  ok: false;
  message: string;
  path: string;
  expected?: string;
}

export type TextureDerivationResult =
  | TextureDerivationSuccess
  | TextureDerivationFailure;

interface FaceTarget {
  nodeId: string;
  direction: CubeFaceDirection;
  textureId: string;
  pattern?: GeneratedSurfacePattern;
}

interface AtlasPlan {
  width: number;
  height: number;
  placementsByTexture: Map<string, UvAtlasPlacement<FaceTarget>[]>;
}

export interface TextureCompositionRegion {
  nodeId: string;
  face: CubeFaceDirection;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  pattern?: GeneratedSurfacePattern;
}

export interface TextureComposition {
  background: string;
  generated: boolean;
  gutter: number;
  regions: readonly TextureCompositionRegion[];
  canvasDetails: readonly TextureCanvasDetail[];
}

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const EPSILON = 1e-9;

const previewColor = (texture: TextureAsset): string => {
  const value = texture.metadata?.previewColor;
  return typeof value === 'string' && COLOR_PATTERN.test(value)
    ? value
    : '#8e98a3';
};

const baseColor = (texture: TextureAsset): string =>
  texture.raster?.background ?? previewColor(texture);

const modelUnitsPerBlock = (document: ProjectDocument): number =>
  document.settings.coordinateSystem.unit === 'pixel' ? 16 : 1;

const pixelsPerBlock = (document: ProjectDocument): number =>
  BASE_PIXELS_PER_BLOCK * document.settings.surfacePixelDensity;

const texelsPerModelUnit = (document: ProjectDocument): number =>
  pixelsPerBlock(document) / modelUnitsPerBlock(document);

const generatedTextureGutter = (
  document: ProjectDocument
): number => document.settings.surfacePixelDensity;

const effectiveFaceDimensions = (
  node: CubeNode,
  direction: CubeFaceDirection
): { width: number; height: number } => {
  const inflate = node.inflate * 2;
  const scale = node.transform.scale.map((value) => Math.abs(value));
  const size = [
    Math.max(
      0,
      Math.abs(node.bounds.to[0] - node.bounds.from[0]) + inflate
    ) * scale[0],
    Math.max(
      0,
      Math.abs(node.bounds.to[1] - node.bounds.from[1]) + inflate
    ) * scale[1],
    Math.max(
      0,
      Math.abs(node.bounds.to[2] - node.bounds.from[2]) + inflate
    ) * scale[2]
  ] as const;
  return cubeFaceDimensions([0, 0, 0], size, direction);
};

export const hasTextureSurfaceArea = (
  node: CubeNode,
  direction: CubeFaceDirection
): boolean => {
  const dimensions = effectiveFaceDimensions(node, direction);
  return dimensions.width > 0 && dimensions.height > 0;
};

const exactTexelSize = (
  document: ProjectDocument,
  node: CubeNode,
  direction: CubeFaceDirection
): { width: number; height: number } | null => {
  const dimensions = effectiveFaceDimensions(node, direction);
  const scale = texelsPerModelUnit(document);
  const width = dimensions.width * scale;
  const height = dimensions.height * scale;
  const roundedWidth = Math.round(width);
  const roundedHeight = Math.round(height);
  return (
    roundedWidth > 0 &&
    roundedHeight > 0 &&
    Math.abs(width - roundedWidth) <= EPSILON &&
    Math.abs(height - roundedHeight) <= EPSILON
  )
    ? { width: roundedWidth, height: roundedHeight }
    : null;
};

const compiledSurfaceAuthority = (
  document: ProjectDocument
): CompiledSurfaceAuthority =>
  buildCompiledSurfaceAuthority(document, {
    texelsPerModelUnit: texelsPerModelUnit(document),
    faceSize: (cube, direction) =>
      exactTexelSize(document, cube, direction)
  });

const activeGeneratedTextureIds = (
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

const invalidGridFace = (
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
        !exactTexelSize(document, node, direction)
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
      const size = exactTexelSize(document, node, direction);
      if (!size) return null;
      const rects = byTexture.get(texture.id) ?? [];
      const pattern = authority.faces.get(
        generatedSurfaceFaceKey(node.id, direction)
      )?.pattern;
      rects.push({
        key: `${node.id}:${direction}`,
        width: size.width,
        height: size.height,
        value: {
          nodeId: node.id,
          direction,
          textureId: texture.id,
          ...(pattern ? { pattern } : {})
        }
      });
      byTexture.set(texture.id, rects);
    }
  }
  return byTexture;
};

const tryResolution = (
  document: ProjectDocument,
  rectsByTexture: ReadonlyMap<string, readonly UvAtlasRect<FaceTarget>[]>,
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

const buildPlan = (
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

const assignmentForPlan = (
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

const nodeMatchesPlan = (
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

const textureMatchesPlan = (
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
    nodeMatchesPlan(
      document,
      nodeId,
      byNode.get(nodeId) ?? [],
      authority
    )
  );
};

const settingsMatchPlan = (
  document: ProjectDocument,
  plan: AtlasPlan
): boolean =>
  document.settings.textureResolution.width === plan.width &&
  document.settings.textureResolution.height === plan.height;

export const generatedTextureMatchesDerivation = (
  document: ProjectDocument,
  textureId: string
): boolean => {
  const texture = document.textures[textureId];
  if (texture?.atlasMode !== 'generate') return true;
  const authority = compiledSurfaceAuthority(document);
  const plan = buildPlan(document, authority);
  return Boolean(
    plan &&
    settingsMatchPlan(document, plan) &&
    textureMatchesPlan(document, textureId, plan, authority)
  );
};

export const staleGeneratedTextureIds = (
  document: ProjectDocument
): ReadonlySet<string> => {
  const authority = compiledSurfaceAuthority(document);
  const textureIds = activeGeneratedTextureIds(document, authority);
  if (textureIds.length === 0) return new Set();
  const plan = buildPlan(document, authority);
  if (!plan || !settingsMatchPlan(document, plan)) {
    return new Set(textureIds);
  }
  return new Set(
    textureIds.filter(
      (textureId) =>
        !textureMatchesPlan(document, textureId, plan, authority)
    )
  );
};

export const composeTextureRaster = (
  document: ProjectDocument,
  texture: TextureAsset
): TextureComposition => {
  const generated = texture.atlasMode === 'generate';
  const authority = compiledSurfaceAuthority(document);
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
        const pattern = authority.faces.get(
          generatedSurfaceFaceKey(node.id, face)
        )?.pattern;
        regions.push({
          nodeId: node.id,
          face,
          x: uv[0],
          y: uv[1],
          width: uv[2] - uv[0],
          height: uv[3] - uv[1],
          color: node.baseColor,
          ...(pattern ? { pattern } : {})
        });
      }
    }
  }
  return {
    background: baseColor(texture),
    generated,
    gutter: generated
      ? generatedTextureGutter(document)
      : 0,
    regions,
    canvasDetails: texture.raster?.canvasDetails ?? []
  };
};

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

const updateFaces = (
  document: ProjectDocument,
  plan: AtlasPlan,
  nodeIds: readonly string[],
  authority: CompiledSurfaceAuthority
): ProjectDocument => {
  const assignment = assignmentForPlan(plan);
  return nodeIds.reduce(
    (current, nodeId) =>
      updateSceneNode(current, nodeId, (node) => {
        if (node.kind !== 'cube') return node;
        return {
          ...node,
          boxUv: false,
          uvOffset: undefined,
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
      }),
    document
  );
};

export const deriveGeneratedTextures = (
  document: ProjectDocument
): TextureDerivationResult => {
  const authority = compiledSurfaceAuthority(document);
  const generatedTextureIds = activeGeneratedTextureIds(
    document,
    authority
  );
  if (generatedTextureIds.length === 0) {
    return {
      ok: true,
      document,
      width: document.settings.textureResolution.width,
      height: document.settings.textureResolution.height,
      pixelsPerBlock: pixelsPerBlock(document),
      texelsPerModelUnit: texelsPerModelUnit(document),
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
  const invalidFace = invalidGridFace(document, authority);
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
  const plan = buildPlan(document, authority);
  if (!plan) {
    return {
      ok: false,
      message:
        'Generated surfaces exceed the 4096 × 4096 atlas at the selected surface density.',
      path: 'scene.nodes',
      expected:
        'less geometry or a lower surface pixel density'
    };
  }
  const placements = [...plan.placementsByTexture.values()].flat();
  const placementsByNode = new Map<
    string,
    UvAtlasPlacement<FaceTarget>[]
  >();
  for (const placement of placements) {
    const nodePlacements =
      placementsByNode.get(placement.value.nodeId) ?? [];
    nodePlacements.push(placement);
    placementsByNode.set(placement.value.nodeId, nodePlacements);
  }
  const candidateNodeIds = new Set([
    ...placementsByNode.keys(),
    ...authority.nodeIds
  ]);
  const changedNodeIds = [...candidateNodeIds].filter(
    (nodeId) =>
      !nodeMatchesPlan(
        document,
        nodeId,
        placementsByNode.get(nodeId) ?? [],
        authority
      )
  );
  const withFaces = updateFaces(
    document,
    plan,
    changedNodeIds,
    authority
  );
  const textures = { ...withFaces.textures };
  const changedTextureIds = generatedTextureIds.filter(
    (textureId) =>
      !textureMatchesPlan(document, textureId, plan, authority)
  );
  for (const textureId of changedTextureIds) {
    const texture = textures[textureId];
    textures[textureId] = {
      ...texture,
      width: plan.width,
      height: plan.height,
      raster: {
        background: baseColor(texture),
        canvasDetails: []
      }
    };
  }
  const changedSettings = !settingsMatchPlan(document, plan);
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
      pixelsPerBlock: pixelsPerBlock(document),
      texelsPerModelUnit: texelsPerModelUnit(document),
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
    pixelsPerBlock: pixelsPerBlock(document),
    texelsPerModelUnit: texelsPerModelUnit(document),
    changedSettings,
    changedNodeIds,
    changedTextureIds
  };
};
