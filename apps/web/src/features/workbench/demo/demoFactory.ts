import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type AnimationLoopMode,
  type AnimationTriggerInput,
  type BoneCreateInput,
  type CubeCreateInput,
  type ProjectCommandOperation,
  type ProjectDocument,
  type TextureAsset,
  type TextureRasterRectangle,
  type TransformChannelInput,
  type Vec3
} from '@ashfox/engine-core';

import {
  createHistoryState,
  historyReducer,
  type HistoryState
} from '../state/historyReducer';

export interface DemoTextureSpec {
  id: string;
  name: string;
  previewColor: string;
  background: string;
  rectangles: readonly TextureRasterRectangle[];
  atlasMode: NonNullable<TextureAsset['atlasMode']>;
  renderMode?: TextureAsset['renderMode'];
}

export interface DemoCubeSpec {
  input: CubeCreateInput;
  textureId: string;
  shade?: boolean;
  lightEmission?: number;
}

export interface DemoAnimationSpec {
  id: string;
  name: string;
  durationSeconds: number;
  fps: number;
  loop: AnimationLoopMode;
  channels: readonly TransformChannelInput[];
  triggers?: readonly AnimationTriggerInput[];
}

export interface DemoDefinition {
  id: string;
  slug: string;
  name: string;
  modelPath: string;
  initialSelectionId: string | null;
  textures: readonly DemoTextureSpec[];
  bones: readonly BoneCreateInput[];
  cubes: readonly DemoCubeSpec[];
  animations: readonly DemoAnimationSpec[];
  atlasSeed: number;
}

const chunk = <T>(
  values: readonly T[],
  size: number
): readonly (readonly T[])[] => {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

const textureAsset = (
  definition: DemoDefinition,
  texture: DemoTextureSpec
): TextureAsset => ({
  id: texture.id,
  name: texture.name,
  width: 128,
  height: 128,
  source: {
    bucket: 'textures',
    key: `demo/${definition.slug}/${texture.id}.png`,
    contentType: 'image/png',
    contentHash: `sha256:demo-${definition.slug}-${texture.id}`
  },
  visible: true,
  sampling: 'nearest',
  colorSpace: 'srgb',
  renderMode: texture.renderMode ?? 'default',
  renderSides: 'double',
  atlasMode: texture.atlasMode,
  pbrChannel: 'color',
  metadata: {
    previewColor: texture.previewColor
  }
});

const createBaseProject = (
  definition: DemoDefinition
): ProjectDocument => ({
  schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
  id: definition.id,
  name: 'Untitled Creation',
  revision: 'local-0001',
  formatProfile: {
    id: 'ashfox.generic',
    version: '1'
  },
  settings: {
    textureResolution: {
      width: 128,
      height: 128
    },
    uvPixelsPerUnit: 0.25,
    coordinateSystem: {
      up: 'y',
      handedness: 'right',
      unit: 'pixel',
      rotationUnit: 'degree',
      rotationOrder: 'xyz'
    }
  },
  scene: {
    roots: [],
    nodes: {}
  },
  textures: Object.fromEntries(
    definition.textures.map((texture) => [
      texture.id,
      textureAsset(definition, texture)
    ])
  ),
  animations: {},
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z'
});

const layerBones = (
  bones: readonly BoneCreateInput[]
): readonly (readonly BoneCreateInput[])[] => {
  const remaining = new Map(bones.map((bone) => [bone.id, bone]));
  const created = new Set<string>();
  const layers: BoneCreateInput[][] = [];
  while (remaining.size > 0) {
    const layer = [...remaining.values()].filter(
      (bone) => bone.parentId === null || created.has(bone.parentId)
    );
    if (layer.length === 0) {
      throw new Error('Demo bone hierarchy contains a cycle or missing parent.');
    }
    layers.push(layer);
    for (const bone of layer) {
      remaining.delete(bone.id);
      created.add(bone.id);
    }
  }
  return layers;
};

const textureStages = (
  definition: DemoDefinition
): readonly ProjectCommandOperation[] =>
  definition.textures.map((texture) => ({
    name: 'textures.raster.set',
    payload: {
      textureId: texture.id,
      background: texture.background,
      atlasMode: texture.atlasMode,
      rectangles: texture.rectangles
    }
  }));

interface MaterialGroup {
  textureId: string;
  shade: boolean;
  lightEmission: number;
  nodeIds: string[];
}

const materialStages = (
  definition: DemoDefinition
): readonly ProjectCommandOperation[] => {
  const groups = new Map<string, MaterialGroup>();
  for (const cube of definition.cubes) {
    const shade = cube.shade ?? true;
    const lightEmission = cube.lightEmission ?? 0;
    const key = `${cube.textureId}:${shade}:${lightEmission}`;
    const group = groups.get(key) ?? {
      textureId: cube.textureId,
      shade,
      lightEmission,
      nodeIds: []
    };
    group.nodeIds.push(cube.input.id);
    groups.set(key, group);
  }
  return [...groups.values()].flatMap((group) =>
    chunk(group.nodeIds, 96).map((nodeIds) => ({
      name: 'scene.cubes.material' as const,
      payload: {
        nodeIds,
        textureId: group.textureId,
        shade: group.shade,
        lightEmission: group.lightEmission
      }
    }))
  );
};

const animationStages = (
  definition: DemoDefinition
): readonly ProjectCommandOperation[][] =>
  definition.animations.flatMap((animation) => {
    const stages: ProjectCommandOperation[][] = [[{
      name: 'animation.clip.upsert',
      payload: {
        id: animation.id,
        name: animation.name,
        durationSeconds: animation.durationSeconds,
        fps: animation.fps,
        loop: animation.loop
      }
    }]];
    if (animation.channels.length > 0) {
      stages.push([{
        name: 'animation.channels.upsert',
        payload: {
          clipId: animation.id,
          channels: animation.channels
        }
      }]);
    }
    if (animation.triggers && animation.triggers.length > 0) {
      stages.push([{
        name: 'animation.triggers.upsert',
        payload: {
          clipId: animation.id,
          triggers: animation.triggers
        }
      }]);
    }
    return stages;
  });

const buildStages = (
  definition: DemoDefinition
): readonly (readonly ProjectCommandOperation[])[] => [
  [{
    name: 'project.rename',
    payload: { name: definition.name }
  }],
  ...layerBones(definition.bones).map((bones) => [{
    name: 'scene.bones.create' as const,
    payload: { bones }
  }]),
  ...chunk(definition.cubes, 24).map((cubes) => [{
    name: 'scene.cubes.create' as const,
    payload: {
      cubes: cubes.map((cube) => ({
        ...cube.input,
        textureId: definition.textures[0]?.id ?? null
      }))
    }
  }]),
  [ ...textureStages(definition) ],
  [ ...materialStages(definition) ],
  [{
    name: 'textures.uvAtlas.generate',
    payload: {
      target: { scope: 'all' },
      pixelsPerBlock: 16,
      padding: 1,
      maxResolution: 1024,
      seed: definition.atlasSeed,
      intensity: 0.28,
      edge: 0.18,
      noise: 0.07,
      lightDir: 'tl_br'
    }
  }],
  ...animationStages(definition),
  [{
    name: 'project.target.set',
    payload: {
      target: 'geckolib5',
      namespace: 'ashfox',
      modelPath: definition.modelPath
    }
  }]
];

const stageTimestamp = (index: number): string =>
  new Date(
    Date.parse('2026-07-29T01:00:00.000Z') + index * 3_000
  ).toISOString();

export const createDemoHistory = (
  definition: DemoDefinition
): HistoryState =>
  buildStages(definition).reduce(
    (state, operations, index) => {
      const batchId =
        `demo-${definition.slug}-${String(index + 1).padStart(2, '0')}`;
      const next = historyReducer(state, {
        type: 'execute',
        batch: {
          batchId,
          baseRevision: state.present.revision,
          operations
        },
        actorId: 'ashfox-demo-agent',
        source: 'agent',
        committedAt: stageTimestamp(index)
      });
      if (next.lastCommandOutcome?.status === 'rejected') {
        throw new Error(
          `${definition.name} stage ${index + 1} failed: ` +
          next.lastCommandOutcome.error.message
        );
      }
      return next;
    },
    createHistoryState(createBaseProject(definition))
  );

export const demoBone = (
  id: string,
  parentId: string | null,
  pivot: Vec3,
  name = id.replace(/^bone-/, '')
): BoneCreateInput => ({
  id,
  name,
  parentId,
  transform: { pivot }
});

export const demoCube = (
  id: string,
  parentId: string,
  pivot: Vec3,
  center: Vec3,
  size: Vec3,
  textureId: string,
  options: {
    name?: string;
    rotation?: Vec3;
    inflate?: number;
    shade?: boolean;
    lightEmission?: number;
  } = {}
): DemoCubeSpec => ({
  input: {
    id,
    name: options.name ?? id.replace(/^cube-/, '').replaceAll('-', ' '),
    parentId,
    bounds: {
      from: [
        center[0] - size[0] / 2,
        center[1] - size[1] / 2,
        center[2] - size[2] / 2
      ],
      to: [
        center[0] + size[0] / 2,
        center[1] + size[1] / 2,
        center[2] + size[2] / 2
      ]
    },
    transform: {
      pivot,
      ...(options.rotation ? { rotation: options.rotation } : {})
    },
    faceUv: [0, 0, 128, 128],
    inflate: options.inflate ?? 0,
    shade: options.shade ?? true
  },
  textureId,
  shade: options.shade,
  lightEmission: options.lightEmission
});

export const demoChannel = (
  id: string,
  targetNodeId: string,
  property: TransformChannelInput['property'],
  keys: readonly [number, Vec3][]
): TransformChannelInput => ({
  id,
  targetNodeId,
  property,
  keys: keys.map(([timeSeconds, value], index) => ({
    id: `${id}-key-${index}`,
    timeSeconds,
    value,
    interpolation: 'linear'
  }))
});
