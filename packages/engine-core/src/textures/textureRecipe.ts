import {
  CUBE_FACE_DIRECTIONS,
  type CubeFaceDirection,
  type CubeNode,
  type GeneratedTextureRecipe,
  type ProjectDocument,
  type SurfaceTextureDetail,
  type TextureAsset,
  type TextureCanvasDetail
} from '../model';
import { updateSceneNode } from '../scene';
import {
  cubeFaceDimensions,
  faceTexelSize,
  packUvAtlas,
  reduceAtlasPixelsPerBlock,
  type UvAtlasPlacement,
  type UvAtlasRect
} from './uvAtlas';
import { stableTextureSeed } from './minecraftShading';

export interface TextureSyncOptions extends GeneratedTextureRecipe {}

const DEFAULT_RECIPE: GeneratedTextureRecipe = {
  pixelsPerBlock: 16,
  padding: 1,
  maxResolution: 256,
  seed: 0x41534846,
  intensity: 0.22,
  edge: 0.12,
  noise: 0.06,
  lightDir: 'tl_br'
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

const storedRecipe = (
  document: ProjectDocument
): GeneratedTextureRecipe | undefined =>
  document.settings.generatedTextureRecipe;

export const resolveTextureSyncOptions = (
  document: ProjectDocument,
  overrides: Partial<TextureSyncOptions> = {}
): TextureSyncOptions => {
  const stored = storedRecipe(document);
  return {
    pixelsPerBlock:
      overrides.pixelsPerBlock ??
      stored?.pixelsPerBlock ??
      DEFAULT_RECIPE.pixelsPerBlock,
    padding:
      overrides.padding ??
      stored?.padding ??
      DEFAULT_RECIPE.padding,
    maxResolution:
      overrides.maxResolution ??
      Math.max(
        stored?.maxResolution ?? DEFAULT_RECIPE.maxResolution,
        document.settings.textureResolution.width,
        document.settings.textureResolution.height
      ),
    seed:
      overrides.seed ??
      stored?.seed ??
      DEFAULT_RECIPE.seed,
    intensity:
      overrides.intensity ??
      stored?.intensity ??
      DEFAULT_RECIPE.intensity,
    edge:
      overrides.edge ??
      stored?.edge ??
      DEFAULT_RECIPE.edge,
    noise:
      overrides.noise ??
      stored?.noise ??
      DEFAULT_RECIPE.noise,
    lightDir:
      overrides.lightDir ??
      stored?.lightDir ??
      DEFAULT_RECIPE.lightDir
  };
};

export interface TextureSyncSuccess {
  ok: true;
  document: ProjectDocument;
  width: number;
  height: number;
  pixelsPerBlock: number;
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
  pixelsPerBlock: number;
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
  seed: number;
  tone: number;
  details: readonly SurfaceTextureDetail[];
}

export interface TextureComposition {
  background: string;
  recipe?: GeneratedTextureRecipe;
  regions: readonly TextureCompositionRegion[];
  canvasDetails: readonly TextureCanvasDetail[];
}

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

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

const collectRects = (
  document: ProjectDocument,
  pixelsPerBlock: number
): Map<string, UvAtlasRect<FaceTarget>[]> => {
  const byTexture = new Map<string, UvAtlasRect<FaceTarget>[]>();
  for (const node of Object.values(document.scene.nodes)) {
    if (node.kind !== 'cube') continue;
    for (const direction of CUBE_FACE_DIRECTIONS) {
      const face = node.faces[direction];
      if (!face.enabled || face.textureId === null) continue;
      const texture = document.textures[face.textureId];
      if (texture?.atlasMode !== 'generate') continue;
      const rects = byTexture.get(texture.id) ?? [];
      byTexture.set(texture.id, rects);
      const size = faceTexelSize(
        effectiveFaceDimensions(node, direction),
        modelUnitsPerBlock(document),
        pixelsPerBlock
      );
      if (!size) continue;
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
    }
  }
  return byTexture;
};

const tryResolution = (
  rectsByTexture: ReadonlyMap<string, readonly UvAtlasRect<FaceTarget>[]>,
  width: number,
  height: number,
  padding: number
): Map<string, UvAtlasPlacement<FaceTarget>[]> | null => {
  const placements = new Map<string, UvAtlasPlacement<FaceTarget>[]>();
  for (const [textureId, rects] of rectsByTexture) {
    const packed = packUvAtlas(rects, width, height, padding);
    if (!packed) return null;
    placements.set(textureId, packed);
  }
  return placements;
};

const buildPlan = (
  document: ProjectDocument,
  options: TextureSyncOptions
): AtlasPlan | null => {
  let pixelsPerBlock = options.pixelsPerBlock;
  const startWidth = document.settings.textureResolution.width;
  const startHeight = document.settings.textureResolution.height;
  while (pixelsPerBlock >= 1) {
    const rects = collectRects(document, pixelsPerBlock);
    if (rects.size === 0) return null;
    let width = startWidth;
    let height = startHeight;
    while (
      width <= options.maxResolution &&
      height <= options.maxResolution
    ) {
      const placements = tryResolution(
        rects,
        width,
        height,
        options.padding
      );
      if (placements) {
        return {
          width,
          height,
          pixelsPerBlock,
          placementsByTexture: placements
        };
      }
      width *= 2;
      height *= 2;
    }
    const reduced = reduceAtlasPixelsPerBlock(pixelsPerBlock);
    if (reduced === null) return null;
    pixelsPerBlock = reduced;
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

const faceTone = (direction: CubeFaceDirection): number => {
  switch (direction) {
    case 'up':
      return 1.08;
    case 'down':
      return 0.72;
    case 'south':
      return 0.98;
    case 'north':
      return 0.92;
    case 'west':
      return 0.86;
    case 'east':
      return 0.8;
  }
};

const recipeMatches = (
  left: GeneratedTextureRecipe | undefined,
  right: GeneratedTextureRecipe
): boolean =>
  left !== undefined &&
  left.pixelsPerBlock === right.pixelsPerBlock &&
  left.padding === right.padding &&
  left.maxResolution === right.maxResolution &&
  left.seed === right.seed &&
  left.intensity === right.intensity &&
  left.edge === right.edge &&
  left.noise === right.noise &&
  left.lightDir === right.lightDir;

const uvMatches = (
  actual: readonly number[] | undefined,
  expected: readonly number[]
): boolean =>
  actual?.length === expected.length &&
  actual.every((value, index) => value === expected[index]);

const expectedUv = (
  placement: UvAtlasPlacement<FaceTarget>
): readonly [number, number, number, number] => [
  placement.x,
  placement.y,
  placement.x + placement.width,
  placement.y + placement.height
];

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
  plan: AtlasPlan,
  options: TextureSyncOptions
): boolean =>
  document.settings.textureResolution.width === plan.width &&
  document.settings.textureResolution.height === plan.height &&
  document.settings.uvPixelsPerUnit ===
    plan.pixelsPerBlock / modelUnitsPerBlock(document) &&
  recipeMatches(
    document.settings.generatedTextureRecipe,
    options
  );

export const isTextureRecipeSynchronized = (
  document: ProjectDocument,
  textureId: string
): boolean => {
  const texture = document.textures[textureId];
  if (texture?.atlasMode !== 'generate') return true;
  const options = resolveTextureSyncOptions(document);
  const plan = buildPlan(document, options);
  return Boolean(
    plan &&
    settingsMatchPlan(document, plan, options) &&
    textureMatchesPlan(document, textureId, plan)
  );
};

export const unsynchronizedGeneratedTextureIds = (
  document: ProjectDocument
): ReadonlySet<string> => {
  const textureIds = activeGeneratedTextureIds(document);
  if (textureIds.length === 0) return new Set();
  const options = resolveTextureSyncOptions(document);
  const plan = buildPlan(document, options);
  if (!plan || !settingsMatchPlan(document, plan, options)) {
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
  const background = baseColor(texture);
  const recipe = texture.atlasMode === 'generate'
    ? document.settings.generatedTextureRecipe
    : undefined;
  const regions: TextureCompositionRegion[] = [];
  if (texture.atlasMode === 'generate' && recipe) {
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
          color: background,
          seed: stableTextureSeed(
            `${texture.id}:${node.id}:${face}`,
            recipe.seed
          ),
          tone: faceTone(face),
          details: surface.details
        });
      }
    }
  }
  return {
    background,
    ...(recipe ? { recipe } : {}),
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

export const synchronizeTextureRecipes = (
  document: ProjectDocument,
  options: TextureSyncOptions
): TextureSyncResult => {
  const generatedTextureIds = activeGeneratedTextureIds(document);
  if (generatedTextureIds.length === 0) {
    return {
      ok: true,
      document,
      width: document.settings.textureResolution.width,
      height: document.settings.textureResolution.height,
      pixelsPerBlock:
        (document.settings.uvPixelsPerUnit ?? 1) *
        modelUnitsPerBlock(document),
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
        `Cube "${mixedCube.id}" mixes generated surfaces with preserved ` +
        'surfaces while box UV is enabled.',
      path: `scene.nodes.${mixedCube.id}.faces`,
      expected: 'one atlas mode per box-UV cube'
    };
  }
  const plan = buildPlan(document, options);
  if (!plan) {
    return {
      ok: false,
      message: 'Texture recipe cannot fit every generated cube surface.',
      path: 'payload.maxResolution',
      expected: 'a larger maximum resolution or less generated geometry'
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
  const recipe: GeneratedTextureRecipe = { ...options };
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
  const changedSettings = !settingsMatchPlan(document, plan, options);
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
      pixelsPerBlock: plan.pixelsPerBlock,
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
            uvPixelsPerUnit:
              plan.pixelsPerBlock / modelUnitsPerBlock(document),
            generatedTextureRecipe: recipe
          }
        : withFaces.settings,
      textures
    },
    width: plan.width,
    height: plan.height,
    pixelsPerBlock: plan.pixelsPerBlock,
    changedSettings,
    changedNodeIds,
    changedTextureIds
  };
};
