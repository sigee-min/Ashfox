import {
  CUBE_FACE_DIRECTIONS,
  type CubeFaceDirection,
  type ProjectDocument,
  type TextureAsset
} from '../../model';
import { updateSceneNode } from '../../scene';
import {
  cubeFaceDimensions,
  faceTexelSize,
  packUvAtlas,
  reduceAtlasPixelsPerBlock,
  type UvAtlasPlacement,
  type UvAtlasRect
} from '../../textures/uvAtlas';
import {
  createTextureAsset,
  implicitTextureId
} from '../../textures/createTextureAsset';
import { stableTextureSeed } from '../../textures/minecraftShading';
import { defineCommand } from '../definition';
import { entityIdsSchema } from './schemas';
import {
  findMissingNodeId,
  findNonCube
} from './sceneHelpers';

const inputSchema = {
  type: 'object',
  properties: {
    target: {
      anyOf: [
        {
          type: 'object',
          properties: {
            scope: {
              enum: ['all']
            }
          },
          required: ['scope'],
          additionalProperties: false
        },
        {
          type: 'object',
          properties: {
            nodeIds: entityIdsSchema
          },
          required: ['nodeIds'],
          additionalProperties: false
        }
      ]
    },
    pixelsPerBlock: {
      type: 'number',
      minimum: 1,
      maximum: 256
    },
    padding: {
      type: 'number',
      minimum: 0,
      maximum: 32
    },
    maxResolution: {
      type: 'number',
      minimum: 16,
      maximum: 4096
    },
    seed: {
      type: 'number'
    },
    intensity: {
      type: 'number',
      minimum: 0,
      maximum: 1
    },
    edge: {
      type: 'number',
      minimum: 0,
      maximum: 1
    },
    noise: {
      type: 'number',
      minimum: 0,
      maximum: 1
    },
    lightDir: {
      enum: ['tl_br', 'tr_bl', 'top_bottom', 'left_right']
    }
  },
  required: [
    'target',
    'pixelsPerBlock',
    'padding',
    'maxResolution',
    'seed',
    'intensity',
    'edge',
    'noise',
    'lightDir'
  ],
  additionalProperties: false
} as const;

interface FaceTarget {
  nodeId: string;
  direction: CubeFaceDirection;
  textureId: string;
  color: string;
}

interface AtlasPlan {
  width: number;
  height: number;
  pixelsPerBlock: number;
  placementsByTexture: Map<string, UvAtlasPlacement<FaceTarget>[]>;
}

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const previewColor = (texture: TextureAsset): string => {
  const value = texture.metadata?.previewColor;
  return typeof value === 'string' && COLOR_PATTERN.test(value)
    ? value
    : '#8e98a3';
};

const baseColorAt = (
  texture: TextureAsset,
  uv: readonly [number, number, number, number] | undefined
): string => {
  const background = texture.raster?.background ?? previewColor(texture);
  if (!uv) return background;
  const x = Math.floor((uv[0] + uv[2]) / 2);
  const y = Math.floor((uv[1] + uv[3]) / 2);
  let color = background;
  for (const rectangle of texture.raster?.rectangles ?? []) {
    if (
      x >= rectangle.x &&
      y >= rectangle.y &&
      x < rectangle.x + rectangle.width &&
      y < rectangle.y + rectangle.height
    ) {
      color = rectangle.color;
    }
  }
  const region = texture.raster?.pattern?.regions.find(
    (entry) =>
      x >= entry.x &&
      y >= entry.y &&
      x < entry.x + entry.width &&
      y < entry.y + entry.height
  );
  return region?.color ?? color;
};

const modelUnitsPerBlock = (document: ProjectDocument): number =>
  document.settings.coordinateSystem.unit === 'pixel' ? 16 : 1;

const targetNodeIds = (
  document: ProjectDocument,
  target:
    | { scope: 'all' }
    | { nodeIds: readonly string[] }
): readonly string[] =>
  'scope' in target
    ? Object.values(document.scene.nodes)
        .filter((node) => node.kind === 'cube')
        .map((node) => node.id)
    : target.nodeIds;

const hasGeneratedFace = (
  document: ProjectDocument,
  nodeIds: readonly string[]
): boolean =>
  nodeIds.some((nodeId) => {
    const node = document.scene.nodes[nodeId];
    return (
      node?.kind === 'cube' &&
      CUBE_FACE_DIRECTIONS.some((direction) => {
        const face = node.faces[direction];
        return (
          face.enabled &&
          face.textureId !== null &&
          document.textures[face.textureId]?.atlasMode === 'generate'
        );
      })
    );
  });

interface PreparedGenerateTargets {
  document: ProjectDocument;
  createdTextureId: string | null;
}

const prepareGenerateTargets = (
  document: ProjectDocument,
  nodeIds: readonly string[]
): PreparedGenerateTargets | null => {
  if (hasGeneratedFace(document, nodeIds)) {
    return {
      document,
      createdTextureId: null
    };
  }
  const hasUntexturedFace = nodeIds.some((nodeId) => {
    const node = document.scene.nodes[nodeId];
    return (
      node?.kind === 'cube' &&
      CUBE_FACE_DIRECTIONS.some(
        (direction) =>
          node.faces[direction].enabled &&
          node.faces[direction].textureId === null
      )
    );
  });
  if (!hasUntexturedFace) return null;

  const existing = Object.values(document.textures).find(
    (texture) => texture.atlasMode === 'generate'
  );
  const created = existing
    ? null
    : createTextureAsset(document, {
        id: implicitTextureId(document),
        name: 'Base texture'
      });
  const texture = existing ?? created;
  if (!texture) return null;
  const withTexture = created
    ? {
        ...document,
        textures: {
          ...document.textures,
          [created.id]: created
        }
      }
    : document;
  const withFaces = nodeIds.reduce(
    (current, nodeId) =>
      updateSceneNode(current, nodeId, (node) => {
        if (node.kind !== 'cube') return node;
        return {
          ...node,
          faces: Object.fromEntries(
            CUBE_FACE_DIRECTIONS.map((direction) => {
              const face = node.faces[direction];
              return [
                direction,
                face.enabled && face.textureId === null
                  ? { ...face, textureId: texture.id }
                  : face
              ];
            })
          ) as typeof node.faces
        };
      }),
    withTexture
  );
  return {
    document: withFaces,
    createdTextureId: created?.id ?? null
  };
};

const collectRects = (
  document: ProjectDocument,
  nodeIds: readonly string[],
  pixelsPerBlock: number
): Map<string, UvAtlasRect<FaceTarget>[]> | null => {
  const byTexture = new Map<string, UvAtlasRect<FaceTarget>[]>();
  for (const nodeId of nodeIds) {
    const node = document.scene.nodes[nodeId];
    if (!node || node.kind !== 'cube') return null;
    for (const direction of CUBE_FACE_DIRECTIONS) {
      const face = node.faces[direction];
      if (!face.enabled || face.textureId === null) continue;
      const texture = document.textures[face.textureId];
      if (!texture) return null;
      if (texture.atlasMode !== 'generate') continue;
      const size = faceTexelSize(
        cubeFaceDimensions(node.bounds.from, node.bounds.to, direction),
        modelUnitsPerBlock(document),
        pixelsPerBlock
      );
      if (!size) return null;
      const rects = byTexture.get(texture.id) ?? [];
      rects.push({
        key: `${node.id}:${direction}`,
        width: size.width,
        height: size.height,
        value: {
          nodeId: node.id,
          direction,
          textureId: texture.id,
          color: baseColorAt(texture, face.uv)
        }
      });
      byTexture.set(texture.id, rects);
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
  nodeIds: readonly string[],
  requestedPixelsPerBlock: number,
  padding: number,
  maxResolution: number
): AtlasPlan | null => {
  let pixelsPerBlock = requestedPixelsPerBlock;
  const startWidth = Math.max(
    document.settings.textureResolution.width,
    ...Object.values(document.textures).map((texture) => texture.width)
  );
  const startHeight = Math.max(
    document.settings.textureResolution.height,
    ...Object.values(document.textures).map((texture) => texture.height)
  );
  while (pixelsPerBlock >= 1) {
    const rects = collectRects(document, nodeIds, pixelsPerBlock);
    if (!rects || rects.size === 0) return null;
    let width = startWidth;
    let height = startHeight;
    while (width <= maxResolution && height <= maxResolution) {
      const placements = tryResolution(rects, width, height, padding);
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

const updateFaces = (
  document: ProjectDocument,
  plan: AtlasPlan
): ProjectDocument => {
  const assignment = new Map<string, readonly [number, number, number, number]>();
  for (const placements of plan.placementsByTexture.values()) {
    for (const placement of placements) {
      assignment.set(
        `${placement.value.nodeId}:${placement.value.direction}`,
        [
          placement.x,
          placement.y,
          placement.x + placement.width,
          placement.y + placement.height
        ]
      );
    }
  }
  return [...new Set(
    [...plan.placementsByTexture.values()]
      .flat()
      .map((placement) => placement.value.nodeId)
  )].reduce(
    (current, nodeId) =>
      updateSceneNode(current, nodeId, (node) => {
        if (node.kind !== 'cube') return node;
        return {
          ...node,
          boxUv: false,
          faces: Object.fromEntries(
            CUBE_FACE_DIRECTIONS.map((direction) => {
              const uv = assignment.get(`${nodeId}:${direction}`);
              return [
                direction,
                uv
                  ? { ...node.faces[direction], uv }
                  : node.faces[direction]
              ];
            })
          ) as typeof node.faces
        };
      }),
    document
  );
};

export const generateMinecraftUvAtlasCommand = defineCommand({
  name: 'textures.uvAtlas.generate',
  label: 'Generate Minecraft UV atlas',
  purpose: 'Pack cube faces at one texel density and shade each UV island deterministically.',
  inputSchema,
  apply: (document, payload) => {
    const nodeIds = targetNodeIds(document, payload.target);
    const missingId = findMissingNodeId(document, nodeIds);
    const nonCube = findNonCube(document, nodeIds);
    const integers = [
      payload.pixelsPerBlock,
      payload.padding,
      payload.maxResolution,
      payload.seed
    ];
    if (
      missingId ||
      nonCube ||
      nodeIds.length === 0 ||
      integers.some((value) => !Number.isInteger(value)) ||
      payload.maxResolution <
        Math.max(
          document.settings.textureResolution.width,
          document.settings.textureResolution.height
        )
    ) {
      return {
        ok: false,
        error: {
          code: missingId || nonCube || nodeIds.length === 0
            ? 'invalid_state'
            : 'invalid_payload',
          message: missingId
            ? `Scene node "${missingId}" does not exist.`
            : nonCube
              ? `Scene node "${nonCube.id}" is not a cube.`
              : nodeIds.length === 0
                ? 'UV atlas generation requires at least one cube.'
                : 'UV atlas density, padding, maximum resolution, and seed must be valid integers.',
          path: missingId || nonCube || nodeIds.length === 0
            ? 'payload.target'
            : 'payload'
        }
      };
    }
    const prepared = prepareGenerateTargets(document, nodeIds);
    if (!prepared) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message:
            'UV atlas target contains no generate-mode or untextured faces.',
          path: 'payload.target',
          expected:
            'at least one generate-mode face or one enabled face with textureId null'
        }
      };
    }
    const plan = buildPlan(
      prepared.document,
      nodeIds,
      payload.pixelsPerBlock,
      payload.padding,
      payload.maxResolution
    );
    if (!plan) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: 'UV atlas cannot fit the selected textured faces.',
          path: 'payload.maxResolution',
          expected: 'a larger maximum resolution or fewer faces'
        }
      };
    }
    const withFaces = updateFaces(prepared.document, plan);
    const textures = { ...withFaces.textures };
    for (const [textureId, placements] of plan.placementsByTexture) {
      const texture = textures[textureId];
      textures[textureId] = {
        ...texture,
        width: plan.width,
        height: plan.height,
        source: {
          bucket: texture.source.bucket,
          key: texture.source.key,
          contentType: texture.source.contentType,
          contentHash: texture.source.contentHash
        },
        raster: {
          background: texture.raster?.background ?? previewColor(texture),
          rectangles: [],
          pattern: {
            kind: 'minecraft_shaded_uv',
            intensity: payload.intensity,
            edge: payload.edge,
            noise: payload.noise,
            lightDir: payload.lightDir,
            regions: placements.map((placement) => ({
              x: placement.x,
              y: placement.y,
              width: placement.width,
              height: placement.height,
              color: placement.value.color,
              seed: stableTextureSeed(
                `${textureId}:${placement.key}`,
                payload.seed
              )
            }))
          }
        }
      };
    }
    const changedTextureIds = [...plan.placementsByTexture.keys()];
    const changedNodeIds = [...new Set(
      [...plan.placementsByTexture.values()]
        .flat()
        .map((placement) => placement.value.nodeId)
    )];
    return {
      ok: true,
      value: {
        document: {
          ...withFaces,
          settings: {
            ...withFaces.settings,
            textureResolution: {
              width: plan.width,
              height: plan.height
            },
            uvPixelsPerUnit:
              plan.pixelsPerBlock / modelUnitsPerBlock(prepared.document)
          },
          textures
        },
        summary:
          `Generated ${plan.width} × ${plan.height} Minecraft UV atlas at ` +
          `${plan.pixelsPerBlock} px/block`,
        effects: {
          createdEntityIds: prepared.createdTextureId
            ? [prepared.createdTextureId]
            : [],
          changedEntityIds: [
            ...changedNodeIds,
            ...changedTextureIds.filter(
              (id) => id !== prepared.createdTextureId
            )
          ],
          removedEntityIds: [],
          invalidated: ['scene', 'textures', 'uv', 'validation', 'preview']
        }
      }
    };
  }
});
