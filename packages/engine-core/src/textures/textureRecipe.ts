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
  cubeFaceDimensions,
  packUvAtlas,
  type UvAtlasPlacement,
  type UvAtlasRect
} from './uvAtlas';

export const GENERATED_PIXELS_PER_BLOCK = 16;
export const GENERATED_TEXELS_PER_MODEL_UNIT = 1;
export const GENERATED_ATLAS_PADDING = 2;
export const GENERATED_ATLAS_MIN_RESOLUTION = 16;
export const GENERATED_ATLAS_MAX_RESOLUTION = 4096;

export interface TextureSyncSuccess {
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

export interface TextureSyncFailure {
  ok: false;
  message: string;
  path: string;
  expected?: string;
}

export type TextureSyncResult =
  | TextureSyncSuccess
  | TextureSyncFailure;

interface FaceTarget {
  nodeId: string;
  direction: CubeFaceDirection;
  textureId: string;
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
}

export interface TextureComposition {
  background: string;
  generated: boolean;
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
  const scale =
    GENERATED_PIXELS_PER_BLOCK / modelUnitsPerBlock(document);
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

const activeGeneratedTextureIds = (
  document: ProjectDocument
): readonly string[] =>
  [...new Set(
    Object.values(document.scene.nodes).flatMap((node) => {
      if (node.kind !== 'cube') return [];
      return CUBE_FACE_DIRECTIONS.flatMap((direction) => {
        const face = node.faces[direction];
        const textureId = face.textureId;
        return (
          face.enabled &&
          textureId !== null &&
          document.textures[textureId]?.atlasMode === 'generate'
        )
          ? [textureId]
          : [];
      });
    })
  )].sort();

const invalidGridFace = (
  document: ProjectDocument
): { nodeId: string; direction: CubeFaceDirection } | null => {
  for (const node of Object.values(document.scene.nodes)) {
    if (node.kind !== 'cube') continue;
    for (const direction of CUBE_FACE_DIRECTIONS) {
      const face = node.faces[direction];
      if (
        face.enabled &&
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
  document: ProjectDocument
): Map<string, UvAtlasRect<FaceTarget>[]> | null => {
  const byTexture = new Map<string, UvAtlasRect<FaceTarget>[]>();
  for (const node of Object.values(document.scene.nodes)) {
    if (node.kind !== 'cube') continue;
    for (const direction of CUBE_FACE_DIRECTIONS) {
      const face = node.faces[direction];
      if (!face.enabled || face.textureId === null) continue;
      const texture = document.textures[face.textureId];
      if (texture?.atlasMode !== 'generate') continue;
      const size = exactTexelSize(document, node, direction);
      if (!size) return null;
      const rects = byTexture.get(texture.id) ?? [];
      rects.push({
        key: `${node.id}:${direction}`,
        width: size.width,
        height: size.height,
        value: {
          nodeId: node.id,
          direction,
          textureId: texture.id
        }
      });
      byTexture.set(texture.id, rects);
    }
  }
  return byTexture;
};

const tryResolution = (
  rectsByTexture: ReadonlyMap<string, readonly UvAtlasRect<FaceTarget>[]>,
  resolution: number
): Map<string, UvAtlasPlacement<FaceTarget>[]> | null => {
  const placements = new Map<string, UvAtlasPlacement<FaceTarget>[]>();
  for (const [textureId, rects] of rectsByTexture) {
    const packed = packUvAtlas(
      rects,
      resolution,
      resolution,
      GENERATED_ATLAS_PADDING
    );
    if (!packed) return null;
    placements.set(textureId, packed);
  }
  return placements;
};

const buildPlan = (
  document: ProjectDocument
): AtlasPlan | null => {
  const rects = collectRects(document);
  if (!rects || rects.size === 0) return null;
  for (
    let resolution = GENERATED_ATLAS_MIN_RESOLUTION;
    resolution <= GENERATED_ATLAS_MAX_RESOLUTION;
    resolution *= 2
  ) {
    const placements = tryResolution(rects, resolution);
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
  placements: readonly UvAtlasPlacement<FaceTarget>[]
): boolean => {
  const node = document.scene.nodes[nodeId];
  if (
    node?.kind !== 'cube' ||
    node.boxUv ||
    node.uvOffset !== undefined
  ) {
    return false;
  }
  return placements.every((placement) => {
    const face = node.faces[placement.value.direction];
    return face.rotation === 0 && uvMatches(face.uv, expectedUv(placement));
  });
};

const textureMatchesPlan = (
  document: ProjectDocument,
  textureId: string,
  plan: AtlasPlan
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
  return [...byNode].every(([nodeId, nodePlacements]) =>
    nodeMatchesPlan(document, nodeId, nodePlacements)
  );
};

const settingsMatchPlan = (
  document: ProjectDocument,
  plan: AtlasPlan
): boolean =>
  document.settings.textureResolution.width === plan.width &&
  document.settings.textureResolution.height === plan.height &&
  document.settings.uvPixelsPerUnit === GENERATED_TEXELS_PER_MODEL_UNIT;

export const isGeneratedTextureSynchronized = (
  document: ProjectDocument,
  textureId: string
): boolean => {
  const texture = document.textures[textureId];
  if (texture?.atlasMode !== 'generate') return true;
  const plan = buildPlan(document);
  return Boolean(
    plan &&
    settingsMatchPlan(document, plan) &&
    textureMatchesPlan(document, textureId, plan)
  );
};

export const unsynchronizedGeneratedTextureIds = (
  document: ProjectDocument
): ReadonlySet<string> => {
  const textureIds = activeGeneratedTextureIds(document);
  if (textureIds.length === 0) return new Set();
  const plan = buildPlan(document);
  if (!plan || !settingsMatchPlan(document, plan)) {
    return new Set(textureIds);
  }
  return new Set(
    textureIds.filter(
      (textureId) =>
        !textureMatchesPlan(document, textureId, plan)
    )
  );
};

export const composeTextureRaster = (
  document: ProjectDocument,
  texture: TextureAsset
): TextureComposition => {
  const generated = texture.atlasMode === 'generate';
  const regions: TextureCompositionRegion[] = [];
  if (generated) {
    for (const node of Object.values(document.scene.nodes)) {
      if (node.kind !== 'cube') continue;
      for (const face of CUBE_FACE_DIRECTIONS) {
        const surface = node.faces[face];
        const uv = surface.uv;
        if (
          !surface.enabled ||
          surface.textureId !== texture.id ||
          !uv ||
          !hasTextureSurfaceArea(node, face)
        ) {
          continue;
        }
        regions.push({
          nodeId: node.id,
          face,
          x: uv[0],
          y: uv[1],
          width: uv[2] - uv[0],
          height: uv[3] - uv[1],
          color: node.baseColor
        });
      }
    }
  }
  return {
    background: baseColor(texture),
    generated,
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
  nodeIds: readonly string[]
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
              return [
                direction,
                uv
                  ? { ...node.faces[direction], uv, rotation: 0 }
                  : node.faces[direction]
              ];
            })
          ) as typeof node.faces
        };
      }),
    document
  );
};

export const synchronizeGeneratedTextures = (
  document: ProjectDocument
): TextureSyncResult => {
  const generatedTextureIds = activeGeneratedTextureIds(document);
  if (generatedTextureIds.length === 0) {
    return {
      ok: true,
      document,
      width: document.settings.textureResolution.width,
      height: document.settings.textureResolution.height,
      pixelsPerBlock: GENERATED_PIXELS_PER_BLOCK,
      texelsPerModelUnit: GENERATED_TEXELS_PER_MODEL_UNIT,
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
  const invalidFace = invalidGridFace(document);
  if (invalidFace) {
    return {
      ok: false,
      message:
        `Cube "${invalidFace.nodeId}" face "${invalidFace.direction}" ` +
        'does not align to the fixed square-pixel grid.',
      path:
        `scene.nodes.${invalidFace.nodeId}.faces.${invalidFace.direction}`,
      expected:
        'bounds, inflate, and scale producing whole texels at 1 texel per model unit'
    };
  }
  const plan = buildPlan(document);
  if (!plan) {
    return {
      ok: false,
      message:
        'Generated surfaces exceed the fixed-density 4096 × 4096 atlas.',
      path: 'scene.nodes',
      expected:
        'less geometry while preserving 1 square texel per model unit'
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
  const changedNodeIds = [...placementsByNode]
    .filter(
      ([nodeId, nodePlacements]) =>
        !nodeMatchesPlan(document, nodeId, nodePlacements)
    )
    .map(([nodeId]) => nodeId);
  const withFaces = updateFaces(document, plan, changedNodeIds);
  const textures = { ...withFaces.textures };
  const changedTextureIds = generatedTextureIds.filter(
    (textureId) =>
      !textureMatchesPlan(document, textureId, plan)
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
      pixelsPerBlock: GENERATED_PIXELS_PER_BLOCK,
      texelsPerModelUnit: GENERATED_TEXELS_PER_MODEL_UNIT,
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
            },
            uvPixelsPerUnit: GENERATED_TEXELS_PER_MODEL_UNIT
          }
        : withFaces.settings,
      textures
    },
    width: plan.width,
    height: plan.height,
    pixelsPerBlock: GENERATED_PIXELS_PER_BLOCK,
    texelsPerModelUnit: GENERATED_TEXELS_PER_MODEL_UNIT,
    changedSettings,
    changedNodeIds,
    changedTextureIds
  };
};
