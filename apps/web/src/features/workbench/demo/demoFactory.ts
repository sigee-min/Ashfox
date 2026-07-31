import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type AnimationLoopMode,
  type AnimationTriggerInput,
  type BoneCreateInput,
  type CubeCreateInput,
  type ProjectCommandOperation,
  type ProjectDocument,
  type ProjectIntentInput,
  type TransformChannelInput,
  type Vec3
} from '@ashfox/engine-core';

import {
  createHistoryState,
  historyReducer,
  type HistoryState
} from '../../../application/historyReducer';

export interface DemoTextureSpec {
  id: string;
  name: string;
  background: string;
}

export interface DemoCubeSpec {
  input: CubeCreateInput;
  textureId: string;
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
  intent: ProjectIntentInput;
  textures: readonly DemoTextureSpec[];
  bones: readonly BoneCreateInput[];
  cubes: readonly DemoCubeSpec[];
  animations: readonly DemoAnimationSpec[];
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
      width: 16,
      height: 16
    },
    surfacePixelDensity: 1,
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
  textures: {},
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
): readonly (readonly ProjectCommandOperation[])[] => {
  const colors = new Map(
    definition.textures.map((texture) => [
      texture.id,
      texture.background
    ])
  );
  return [
  [{
    name: 'project.rename',
    payload: { name: definition.name }
  }, {
    name: 'project.intent.set',
    payload: definition.intent
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
        baseColor: colors.get(cube.textureId) ?? '#8e98a3'
      }))
    }
  }]),
  ...animationStages(definition),
  [{
    name: 'project.target.set',
    payload: {
      target: 'geckolib5'
    }
  }, {
    name: 'project.resource.set',
    payload: {
      namespace: 'ashfox',
      modelPath: definition.modelPath
    }
  }]
  ];
};

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
          baseProjectId: state.present.id,
          baseRevision: state.present.revision,
          operations
        },
        actorId: 'ashfox-demo-fixture',
        source: 'system',
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
  } = {}
): DemoCubeSpec => {
  const gridSize: Vec3 = [
    Math.max(1, Math.round(size[0])),
    Math.max(1, Math.round(size[1])),
    Math.max(1, Math.round(size[2]))
  ];
  return {
    input: {
      id,
      name: options.name ?? id.replace(/^cube-/, '').replaceAll('-', ' '),
      parentId,
      bounds: {
        from: [
          center[0] - gridSize[0] / 2,
          center[1] - gridSize[1] / 2,
          center[2] - gridSize[2] / 2
        ],
        to: [
          center[0] + gridSize[0] / 2,
          center[1] + gridSize[1] / 2,
          center[2] + gridSize[2] / 2
        ]
      },
      transform: {
        pivot,
        ...(options.rotation ? { rotation: options.rotation } : {})
      },
      inflate: options.inflate ?? 0
    },
    textureId
  };
};

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
