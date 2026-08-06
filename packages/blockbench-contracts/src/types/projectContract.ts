import {
  MESH_UV_POLICY_LIMITS
} from '../mcpSchemas/constants';
import {
  isClosedContractRecord,
  isDenseContractArray,
  isFiniteJsonValue,
  isNonEmptyContractText
} from '@ashfox/internal-contracts';

import {
  MESH_SYMMETRY_AXES,
  TRACKED_ANIMATION_CHANNELS,
  TRACKED_ANIMATION_INTERPOLATIONS,
  TRACKED_ANIMATION_TRIGGER_TYPES,
  type ProjectDiff,
  type ProjectDiffCountsByKind,
  type ProjectDiffSet,
  type ProjectState,
  type ProjectTextureUsage,
  type TrackedAnimation,
  type TrackedBone,
  type TrackedCube,
  type TrackedCubeFace,
  type TrackedMesh,
  type TrackedTexture
} from './project';
import {
  CUBE_FACE_DIRECTIONS,
  FORMAT_KINDS
} from './shared';
import {
  TEXTURE_FRAME_ORDER_TYPES,
  TEXTURE_PBR_CHANNELS
} from './texture';

type ContractRecord = Readonly<Record<string, unknown>>;
type ValueGuard<T> = (value: unknown) => value is T;

const owns = (value: ContractRecord, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const hasShape = (
  value: ContractRecord,
  required: readonly string[],
  optional: readonly string[] = []
): boolean => {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => owns(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key));
};

const optional = (
  value: ContractRecord,
  key: string,
  guard: (value: unknown) => boolean
): boolean => !owns(value, key) || guard(value[key]);

const isString = (value: unknown): value is string =>
  typeof value === 'string';
const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean';
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isFiniteNumberInRange = (
  value: unknown,
  minimum: number,
  maximum: number
): value is number =>
  isFiniteNumber(value) && value >= minimum && value <= maximum;
const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

const isEnumValue = <T extends string>(
  values: readonly T[],
  value: unknown
): value is T => typeof value === 'string' && values.includes(value as T);

const isFiniteTuple = <TLength extends number>(
  value: unknown,
  length: TLength
): value is number[] & { length: TLength } =>
  isDenseContractArray(value) &&
  value.length === length &&
  value.every(isFiniteNumber);

const isVec2 = (value: unknown): value is [number, number] =>
  isFiniteTuple(value, 2);
const isVec3 = (value: unknown): value is [number, number, number] =>
  isFiniteTuple(value, 3);
const isVec4 = (
  value: unknown
): value is [number, number, number, number] => isFiniteTuple(value, 4);

const isStringArray = (value: unknown): value is string[] =>
  isDenseContractArray(value) && value.every(isString);

const isArrayOf = <T>(
  value: unknown,
  guard: ValueGuard<T>
): value is T[] => isDenseContractArray(value) && value.every(guard);

const isCubeFaceDirection = (
  value: unknown
): value is (typeof CUBE_FACE_DIRECTIONS)[number] =>
  isEnumValue(CUBE_FACE_DIRECTIONS, value);

export const isTrackedBoneContract = (
  value: unknown
): value is TrackedBone => {
  if (
    !isClosedContractRecord(value) ||
    !hasShape(value, ['name', 'pivot'], [
      'id',
      'parent',
      'rotation',
      'scale',
      'visibility'
    ])
  ) {
    return false;
  }
  return isString(value.name) &&
    isVec3(value.pivot) &&
    optional(value, 'id', isString) &&
    optional(value, 'parent', isString) &&
    optional(value, 'rotation', isVec3) &&
    optional(value, 'scale', isVec3) &&
    optional(value, 'visibility', isBoolean);
};

export const isTrackedCubeFaceContract = (
  value: unknown
): value is TrackedCubeFace => {
  if (
    !isClosedContractRecord(value) ||
    !hasShape(value, ['enabled'], [
      'texture',
      'uv',
      'rotation',
      'cullface',
      'tintIndex',
      'materialInstance'
    ]) ||
    !isBoolean(value.enabled)
  ) {
    return false;
  }
  return optional(
    value,
    'texture',
    (entry): entry is string | false | null =>
      entry === false || entry === null || typeof entry === 'string'
  ) &&
    optional(value, 'uv', isVec4) &&
    optional(
      value,
      'rotation',
      (entry): entry is 0 | 90 | 180 | 270 =>
        entry === 0 || entry === 90 || entry === 180 || entry === 270
    ) &&
    optional(value, 'cullface', isCubeFaceDirection) &&
    optional(value, 'tintIndex', isFiniteNumber) &&
    optional(value, 'materialInstance', isString);
};

const isTrackedCubeFaces = (
  value: unknown
): value is NonNullable<TrackedCube['faces']> =>
  isClosedContractRecord(value) &&
  Object.keys(value).every((key) =>
    isCubeFaceDirection(key) && isTrackedCubeFaceContract(value[key])
  );

export const isTrackedCubeContract = (
  value: unknown
): value is TrackedCube => {
  if (
    !isClosedContractRecord(value) ||
    !hasShape(value, ['name', 'from', 'to', 'bone'], [
      'id',
      'origin',
      'rotation',
      'uv',
      'uvOffset',
      'inflate',
      'mirror',
      'visibility',
      'boxUv',
      'shade',
      'lightEmission',
      'rescale',
      'faces'
    ])
  ) {
    return false;
  }
  return isString(value.name) &&
    isVec3(value.from) &&
    isVec3(value.to) &&
    isString(value.bone) &&
    optional(value, 'id', isString) &&
    optional(value, 'origin', isVec3) &&
    optional(value, 'rotation', isVec3) &&
    optional(value, 'uv', isVec2) &&
    optional(value, 'uvOffset', isVec2) &&
    optional(value, 'inflate', isFiniteNumber) &&
    optional(value, 'mirror', isBoolean) &&
    optional(value, 'visibility', isBoolean) &&
    optional(value, 'boxUv', isBoolean) &&
    optional(value, 'shade', isBoolean) &&
    optional(value, 'lightEmission', isFiniteNumber) &&
    optional(value, 'rescale', isBoolean) &&
    optional(value, 'faces', isTrackedCubeFaces);
};

const isMeshUvPolicy = (
  value: unknown
): value is NonNullable<TrackedMesh['uvPolicy']> =>
  isClosedContractRecord(value) &&
  hasShape(value, [], ['symmetryAxis', 'texelDensity', 'padding']) &&
  optional(
    value,
    'symmetryAxis',
    (entry): entry is NonNullable<TrackedMesh['uvPolicy']>['symmetryAxis'] =>
      isEnumValue(MESH_SYMMETRY_AXES, entry)
  ) &&
  optional(
    value,
    'texelDensity',
    (entry) => isFiniteNumberInRange(
      entry,
      MESH_UV_POLICY_LIMITS.minTexelDensity,
      MESH_UV_POLICY_LIMITS.maxTexelDensity
    )
  ) &&
  optional(
    value,
    'padding',
    (entry) => isFiniteNumberInRange(
      entry,
      MESH_UV_POLICY_LIMITS.minPadding,
      MESH_UV_POLICY_LIMITS.maxPadding
    )
  );

const isTrackedMeshVertex = (
  value: unknown
): value is TrackedMesh['vertices'][number] =>
  isClosedContractRecord(value) &&
  hasShape(value, ['id', 'pos']) &&
  isString(value.id) &&
  isVec3(value.pos);

const isTrackedMeshFaceUv = (
  value: unknown
): value is NonNullable<TrackedMesh['faces'][number]['uv']>[number] =>
  isClosedContractRecord(value) &&
  hasShape(value, ['vertexId', 'uv']) &&
  isString(value.vertexId) &&
  isVec2(value.uv);

const isTrackedMeshFace = (
  value: unknown
): value is TrackedMesh['faces'][number] => {
  if (
    !isClosedContractRecord(value) ||
    !hasShape(value, ['vertices'], ['id', 'uv', 'texture']) ||
    !isStringArray(value.vertices)
  ) {
    return false;
  }
  return optional(value, 'id', isString) &&
    optional(
      value,
      'uv',
      (entry): entry is NonNullable<TrackedMesh['faces'][number]['uv']> =>
        isArrayOf(entry, isTrackedMeshFaceUv)
    ) &&
    optional(
      value,
      'texture',
      (entry): entry is string | false =>
        entry === false || typeof entry === 'string'
    );
};

export const isTrackedMeshContract = (
  value: unknown
): value is TrackedMesh => {
  if (
    !isClosedContractRecord(value) ||
    !hasShape(value, ['name', 'vertices', 'faces'], [
      'id',
      'bone',
      'origin',
      'rotation',
      'visibility',
      'uvPolicy'
    ])
  ) {
    return false;
  }
  return isString(value.name) &&
    isArrayOf(value.vertices, isTrackedMeshVertex) &&
    isArrayOf(value.faces, isTrackedMeshFace) &&
    optional(value, 'id', isString) &&
    optional(value, 'bone', isString) &&
    optional(value, 'origin', isVec3) &&
    optional(value, 'rotation', isVec3) &&
    optional(value, 'visibility', isBoolean) &&
    optional(value, 'uvPolicy', isMeshUvPolicy);
};

export const isTrackedTextureContract = (
  value: unknown
): value is TrackedTexture => {
  if (
    !isClosedContractRecord(value) ||
    !hasShape(value, ['name'], [
      'id',
      'path',
      'width',
      'height',
      'contentHash',
      'namespace',
      'folder',
      'particle',
      'visible',
      'renderMode',
      'renderSides',
      'pbrChannel',
      'group',
      'frameTime',
      'frameOrderType',
      'frameOrder',
      'frameInterpolate',
      'internal',
      'keepSize'
    ]) ||
    !isString(value.name)
  ) {
    return false;
  }
  return ['id', 'path', 'contentHash', 'namespace', 'folder', 'renderMode',
    'renderSides', 'group', 'frameOrder'].every((key) =>
      optional(value, key, isString)
    ) &&
    optional(value, 'width', isNonNegativeInteger) &&
    optional(value, 'height', isNonNegativeInteger) &&
    ['particle', 'visible', 'frameInterpolate', 'internal', 'keepSize'].every(
      (key) => optional(value, key, isBoolean)
    ) &&
    optional(
      value,
      'pbrChannel',
      (entry): entry is NonNullable<TrackedTexture['pbrChannel']> =>
        isEnumValue(TEXTURE_PBR_CHANNELS, entry)
    ) &&
    optional(value, 'frameTime', isFiniteNumber) &&
    optional(
      value,
      'frameOrderType',
      (entry): entry is NonNullable<TrackedTexture['frameOrderType']> =>
        isEnumValue(TEXTURE_FRAME_ORDER_TYPES, entry)
    );
};

const isAnimationChannelKey = (
  value: unknown
): value is NonNullable<TrackedAnimation['channels']>[number]['keys'][number] =>
  isClosedContractRecord(value) &&
  hasShape(value, ['time', 'value'], ['interp']) &&
  isFiniteNumber(value.time) &&
  isVec3(value.value) &&
  optional(
    value,
    'interp',
    (entry): entry is NonNullable<
      NonNullable<TrackedAnimation['channels']>[number]['keys'][number]['interp']
    > => isEnumValue(TRACKED_ANIMATION_INTERPOLATIONS, entry)
  );

const isAnimationChannel = (
  value: unknown
): value is NonNullable<TrackedAnimation['channels']>[number] =>
  isClosedContractRecord(value) &&
  hasShape(value, ['bone', 'channel', 'keys']) &&
  isString(value.bone) &&
  isEnumValue(TRACKED_ANIMATION_CHANNELS, value.channel) &&
  isArrayOf(value.keys, isAnimationChannelKey);

const isTriggerValue = (
  value: unknown
): value is string | string[] | Record<string, unknown> =>
  typeof value === 'string' ||
  isStringArray(value) ||
  (isClosedContractRecord(value) && isFiniteJsonValue(value));

const isAnimationTriggerKey = (
  value: unknown
): value is NonNullable<TrackedAnimation['triggers']>[number]['keys'][number] =>
  isClosedContractRecord(value) &&
  hasShape(value, ['time', 'value']) &&
  isFiniteNumber(value.time) &&
  isTriggerValue(value.value);

const isAnimationTrigger = (
  value: unknown
): value is NonNullable<TrackedAnimation['triggers']>[number] =>
  isClosedContractRecord(value) &&
  hasShape(value, ['type', 'keys']) &&
  isEnumValue(TRACKED_ANIMATION_TRIGGER_TYPES, value.type) &&
  isArrayOf(value.keys, isAnimationTriggerKey);

export const isTrackedAnimationContract = (
  value: unknown
): value is TrackedAnimation => {
  if (
    !isClosedContractRecord(value) ||
    !hasShape(value, ['name', 'length', 'loop'], [
      'id',
      'fps',
      'channels',
      'triggers'
    ]) ||
    !isString(value.name) ||
    !isFiniteNumber(value.length) ||
    !isBoolean(value.loop)
  ) {
    return false;
  }
  return optional(value, 'id', isString) &&
    optional(value, 'fps', isFiniteNumber) &&
    optional(
      value,
      'channels',
      (entry): entry is NonNullable<TrackedAnimation['channels']> =>
        isArrayOf(entry, isAnimationChannel)
    ) &&
    optional(
      value,
      'triggers',
      (entry): entry is NonNullable<TrackedAnimation['triggers']> =>
        isArrayOf(entry, isAnimationTrigger)
    );
};

export const isProjectDiffCountsByKindContract = (
  value: unknown
): value is ProjectDiffCountsByKind => {
  const isCount = (entry: unknown): boolean =>
    isClosedContractRecord(entry) &&
    hasShape(entry, ['added', 'removed', 'changed']) &&
    isNonNegativeInteger(entry.added) &&
    isNonNegativeInteger(entry.removed) &&
    isNonNegativeInteger(entry.changed);
  return isClosedContractRecord(value) &&
    hasShape(value, ['bones', 'cubes', 'textures', 'animations'], ['meshes']) &&
    isCount(value.bones) &&
    isCount(value.cubes) &&
    isCount(value.textures) &&
    isCount(value.animations) &&
    optional(value, 'meshes', isCount);
};

const isProjectDiffSet = <T>(
  value: unknown,
  itemGuard: ValueGuard<T>
): value is ProjectDiffSet<T> => {
  const entryGuard = (
    entry: unknown
  ): entry is { key: string; item: T } =>
    isClosedContractRecord(entry) &&
    hasShape(entry, ['key', 'item']) &&
    isNonEmptyContractText(entry.key) &&
    itemGuard(entry.item);
  const changeGuard = (
    entry: unknown
  ): entry is { key: string; before: T; after: T } =>
    isClosedContractRecord(entry) &&
    hasShape(entry, ['key', 'before', 'after']) &&
    isNonEmptyContractText(entry.key) &&
    itemGuard(entry.before) &&
    itemGuard(entry.after);
  if (!(isClosedContractRecord(value) &&
    hasShape(value, ['added', 'removed', 'changed']) &&
    isDenseContractArray(value.added) && value.added.every(entryGuard) &&
    isDenseContractArray(value.removed) && value.removed.every(entryGuard) &&
    isDenseContractArray(value.changed) && value.changed.every(changeGuard))) {
    return false;
  }
  const set = value as unknown as ProjectDiffSet<T>;
  const keys = [
    ...set.added.map((entry) => entry.key),
    ...set.removed.map((entry) => entry.key),
    ...set.changed.map((entry) => entry.key)
  ];
  return new Set(keys).size === keys.length;
};

const matchesDiffCounts = (
  set: ProjectDiffSet<unknown>,
  counts: { added: number; removed: number; changed: number }
): boolean =>
  set.added.length === counts.added &&
  set.removed.length === counts.removed &&
  set.changed.length === counts.changed;

export const isProjectDiffContract = (
  value: unknown
): value is ProjectDiff => {
  if (
    !isClosedContractRecord(value) ||
    !hasShape(value, ['sinceRevision', 'currentRevision', 'counts'], [
      'baseMissing',
      'bones',
      'cubes',
      'meshes',
      'textures',
      'animations'
    ]) ||
    !isNonEmptyContractText(value.sinceRevision) ||
    !isNonEmptyContractText(value.currentRevision) ||
    !isProjectDiffCountsByKindContract(value.counts)
  ) {
    return false;
  }
  if (!(optional(value, 'baseMissing', isBoolean) &&
    optional(value, 'bones', (entry): entry is ProjectDiff['bones'] =>
      isProjectDiffSet(entry, isTrackedBoneContract)) &&
    optional(value, 'cubes', (entry): entry is ProjectDiff['cubes'] =>
      isProjectDiffSet(entry, isTrackedCubeContract)) &&
    optional(value, 'meshes', (entry): entry is ProjectDiff['meshes'] =>
      isProjectDiffSet(entry, isTrackedMeshContract)) &&
    optional(value, 'textures', (entry): entry is ProjectDiff['textures'] =>
      isProjectDiffSet(entry, isTrackedTextureContract)) &&
    optional(value, 'animations', (entry): entry is ProjectDiff['animations'] =>
      isProjectDiffSet(entry, isTrackedAnimationContract)))) {
    return false;
  }
  const diff = value as unknown as ProjectDiff;
  return (!diff.bones || matchesDiffCounts(diff.bones, diff.counts.bones)) &&
    (!diff.cubes || matchesDiffCounts(diff.cubes, diff.counts.cubes)) &&
    (!diff.meshes || (
      diff.counts.meshes !== undefined &&
      matchesDiffCounts(diff.meshes, diff.counts.meshes)
    )) &&
    (!diff.textures ||
      matchesDiffCounts(diff.textures, diff.counts.textures)) &&
    (!diff.animations ||
      matchesDiffCounts(diff.animations, diff.counts.animations));
};

const isStateCounts = (value: unknown): value is ProjectState['counts'] =>
  isClosedContractRecord(value) &&
  hasShape(value, ['bones', 'cubes', 'textures', 'animations'], [
    'meshes',
    'meshVertices',
    'meshFaces'
  ]) &&
  isNonNegativeInteger(value.bones) &&
  isNonNegativeInteger(value.cubes) &&
  isNonNegativeInteger(value.textures) &&
  isNonNegativeInteger(value.animations) &&
  optional(value, 'meshes', isNonNegativeInteger) &&
  optional(value, 'meshVertices', isNonNegativeInteger) &&
  optional(value, 'meshFaces', isNonNegativeInteger);

const isTextureResolution = (
  value: unknown
): value is NonNullable<ProjectState['textureResolution']> =>
  isClosedContractRecord(value) &&
  hasShape(value, ['width', 'height']) &&
  isNonNegativeInteger(value.width) &&
  isNonNegativeInteger(value.height);

const isTextureUsageFace = (
  value: unknown
): value is ProjectTextureUsage['textures'][number]['cubes'][number]['faces'][number] =>
  isClosedContractRecord(value) &&
  hasShape(value, ['face'], ['uv']) &&
  isCubeFaceDirection(value.face) &&
  optional(value, 'uv', isVec4);

const isTextureUsageCube = (
  value: unknown
): value is ProjectTextureUsage['textures'][number]['cubes'][number] =>
  isClosedContractRecord(value) &&
  hasShape(value, ['name', 'faces'], ['id']) &&
  isString(value.name) &&
  isArrayOf(value.faces, isTextureUsageFace) &&
  optional(value, 'id', isString);

const isTextureUsageEntry = (
  value: unknown
): value is ProjectTextureUsage['textures'][number] => {
  if (
    !isClosedContractRecord(value) ||
    !hasShape(
      value,
      ['name', 'cubeCount', 'faceCount', 'cubes'],
      ['id', 'width', 'height']
    ) ||
    !isString(value.name) ||
    !isNonNegativeInteger(value.cubeCount) ||
    !isNonNegativeInteger(value.faceCount) ||
    !isArrayOf(value.cubes, isTextureUsageCube) ||
    !optional(value, 'id', isString) ||
    !optional(value, 'width', isNonNegativeInteger) ||
    !optional(value, 'height', isNonNegativeInteger)
  ) {
    return false;
  }
  return value.cubeCount === value.cubes.length &&
    value.faceCount === value.cubes.reduce(
      (count, cube) => count + cube.faces.length,
      0
    );
};

const isTextureUsageUnresolved = (
  value: unknown
): value is NonNullable<ProjectTextureUsage['unresolved']>[number] =>
  isClosedContractRecord(value) &&
  hasShape(value, ['textureRef', 'cubeName', 'face'], ['cubeId']) &&
  isString(value.textureRef) &&
  isString(value.cubeName) &&
  isCubeFaceDirection(value.face) &&
  optional(value, 'cubeId', isString);

const isProjectTextureUsage = (
  value: unknown
): value is ProjectTextureUsage =>
  isClosedContractRecord(value) &&
  hasShape(value, ['textures'], ['unresolved']) &&
  isArrayOf(value.textures, isTextureUsageEntry) &&
  optional(
    value,
    'unresolved',
    (entry): entry is NonNullable<ProjectTextureUsage['unresolved']> =>
      isArrayOf(entry, isTextureUsageUnresolved)
  );

export const isProjectStateContract = (
  value: unknown
): value is ProjectState => {
  if (
    !isClosedContractRecord(value) ||
    !hasShape(value, ['id', 'active', 'name', 'format', 'revision', 'counts'], [
      'formatId',
      'dirty',
      'textureResolution',
      'uvPixelsPerBlock',
      'textureUsage',
      'bones',
      'cubes',
      'meshes',
      'textures',
      'animations'
    ]) ||
    !isNonEmptyContractText(value.id) ||
    !isBoolean(value.active) ||
    !isNullableString(value.name) ||
    !(value.format === null || isEnumValue(FORMAT_KINDS, value.format)) ||
    !isNonEmptyContractText(value.revision) ||
    !isStateCounts(value.counts)
  ) {
    return false;
  }
  if (!(optional(value, 'formatId', isNullableString) &&
    optional(value, 'dirty', isBoolean) &&
    optional(value, 'textureResolution', isTextureResolution) &&
    optional(value, 'uvPixelsPerBlock', isFiniteNumber) &&
    optional(value, 'textureUsage', isProjectTextureUsage) &&
    optional(value, 'bones', (entry): entry is TrackedBone[] =>
      isArrayOf(entry, isTrackedBoneContract)) &&
    optional(value, 'cubes', (entry): entry is TrackedCube[] =>
      isArrayOf(entry, isTrackedCubeContract)) &&
    optional(value, 'meshes', (entry): entry is TrackedMesh[] =>
      isArrayOf(entry, isTrackedMeshContract)) &&
    optional(value, 'textures', (entry): entry is TrackedTexture[] =>
      isArrayOf(entry, isTrackedTextureContract)) &&
    optional(value, 'animations', (entry): entry is TrackedAnimation[] =>
      isArrayOf(entry, isTrackedAnimationContract)))) {
    return false;
  }
  const state = value as unknown as ProjectState;
  const meshVertexCount = state.meshes?.reduce(
    (sum, mesh) => sum + mesh.vertices.length,
    0
  );
  const meshFaceCount = state.meshes?.reduce(
    (sum, mesh) => sum + mesh.faces.length,
    0
  );
  return (state.bones === undefined || state.bones.length === state.counts.bones) &&
    (state.cubes === undefined || state.cubes.length === state.counts.cubes) &&
    (state.meshes === undefined || (
      state.counts.meshes === state.meshes.length &&
      state.counts.meshVertices === meshVertexCount &&
      state.counts.meshFaces === meshFaceCount
    )) &&
    (state.textures === undefined ||
      state.textures.length === state.counts.textures) &&
    (state.animations === undefined ||
      state.animations.length === state.counts.animations);
};

export const isProjectStateCountsContract = isStateCounts;
export const isProjectTextureResolutionContract = isTextureResolution;
