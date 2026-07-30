import {
  CUBE_FACE_DIRECTIONS,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  isSurfacePixelDensity,
  type AnimationEffect,
  type AnimationClip,
  type AnimationScalar,
  type AnimationTriggerTrack,
  type AnimationVec3,
  type CubeFaceDirection,
  type CubeNode,
  type EntityId,
  type KeyframeEasing,
  type MeshNode,
  type MinecraftResourceLocation,
  type ProjectDocument,
  type Transform,
  type Vec2,
  type Vec3
} from './model';
import {
  staleGeneratedTextureIds
} from './textures/textureRecipe';
import { findFullyOccludedCubes } from './sceneOcclusion';

export type InvariantSeverity = 'error' | 'warning' | 'info';

export type InvariantCode =
  | 'document.schema_version'
  | 'document.required_value'
  | 'document.invalid_timestamp'
  | 'document.invalid_setting'
  | 'identity.key_mismatch'
  | 'identity.duplicate'
  | 'scene.root_duplicate'
  | 'scene.root_missing'
  | 'scene.root_parent'
  | 'scene.parent_missing'
  | 'scene.parent_not_bone'
  | 'scene.parent_cycle'
  | 'scene.root_membership'
  | 'scene.invalid_kind'
  | 'value.not_finite'
  | 'value.invalid_scale'
  | 'cube.invalid_bounds'
  | 'cube.invalid_face'
  | 'cube.texture_missing'
  | 'cube.fully_occluded'
  | 'mesh.vertex_missing'
  | 'mesh.face_too_small'
  | 'mesh.face_vertex_duplicate'
  | 'mesh.uv_vertex_missing'
  | 'texture.invalid_dimensions'
  | 'texture.invalid_blob'
  | 'texture.invalid_atlas_mode'
  | 'texture.invalid_raster'
  | 'texture.recipe_stale'
  | 'animation.invalid_timing'
  | 'animation.target_missing'
  | 'animation.key_order'
  | 'animation.key_out_of_range'
  | 'animation.invalid_value'
  | 'animation.invalid_loop'
  | 'animation.invalid_effect'
  | 'animation.channel_duplicate'
  | 'animation.name_duplicate'
  | 'format.invalid_namespace'
  | 'format.invalid_resource_path'
  | 'format.invalid_identifier'
  | 'format.unsupported_data'
  | 'format.unbaked_transform'
  | 'format.coordinate_overflow'
  | 'format.rotation_unsupported'
  | 'format.texture_missing'
  | 'format.texture_binding_missing'
  | 'format.texture_key_duplicate'
  | 'format.texture_path_duplicate'
  | 'format.texture_type_unsupported'
  | 'format.uv_missing';

export interface InvariantFinding {
  code: InvariantCode;
  severity: InvariantSeverity;
  message: string;
  path: string;
  entityIds?: readonly EntityId[];
  assetIds?: readonly string[];
  clipIds?: readonly string[];
  fix?: string;
}

export interface ValidationReport {
  valid: boolean;
  findings: readonly InvariantFinding[];
}

export interface ValidateProjectOptions {
  includeFormatProfile?: boolean;
}

export class ProjectInvariantError extends Error {
  readonly report: ValidationReport;

  constructor(report: ValidationReport) {
    super(
      `Project document violates ${report.findings.filter((finding) => finding.severity === 'error').length} invariant(s).`
    );
    this.name = 'ProjectInvariantError';
    this.report = report;
  }
}

const RESOURCE_NAMESPACE_PATTERN = /^[a-z0-9_.-]+$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const RESOURCE_PATH_PATTERN = /^[a-z0-9_./-]+$/;
const TEXTURE_KEY_PATTERN = /^[a-z0-9_.-]+$/;
const JAVA_MODEL_PATH_PATTERN = /^[a-z0-9_./-]+$/;
const BEDROCK_GEOMETRY_IDENTIFIER_PATTERN = /^geometry\.[a-z0-9_.-]+$/;
const MINECRAFT_ANIMATION_IDENTIFIER_PATTERN = /^animation\.[a-z0-9_.-]+$/;
const GLTF_MODEL_PATH_PATTERN = /^[A-Za-z0-9_./-]+$/;
const ANIMATION_LOOP_MODES = new Set<string>([
  'once',
  'loop',
  'hold_on_last_frame'
]);
const ANIMATION_INTERPOLATIONS = new Set<string>([
  'linear',
  'step',
  'catmullrom'
]);
const ANIMATION_PROPERTIES = new Set<string>([
  'position',
  'rotation',
  'scale'
]);
const FORMAT_PROFILE_IDS = new Set<string>([
  'ashfox.generic',
  'minecraft.java_block',
  'minecraft.bedrock',
  'minecraft.java.geckolib5',
  'gltf.2'
]);
const JAVA_ROTATION_ANGLES = [-45, -22.5, 0, 22.5, 45] as const;
const CUBE_FACE_ROTATIONS = [0, 90, 180, 270] as const;
const CUBE_FACE_DIRECTION_SET = new Set<string>(CUBE_FACE_DIRECTIONS);
const EPSILON = 0.000001;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isAnimationEffectValue = (value: unknown): value is AnimationEffect =>
  typeof value === 'object' &&
  value !== null &&
  'effect' in value &&
  typeof value.effect === 'string';

const isAnimationEffectArrayValue = (
  value: unknown
): value is readonly AnimationEffect[] =>
  Array.isArray(value) &&
  value.every((entry) => isAnimationEffectValue(entry));

const isSafeBlobBucket = (value: string): boolean =>
  /^[A-Za-z0-9_.-]+$/.test(value) && value !== '.' && value !== '..';

const isSafeBlobKey = (value: string): boolean =>
  !value.startsWith('/') &&
  !value.includes('\\') &&
  !/^[A-Za-z]:/.test(value) &&
  value.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');

const isIdentityPosition = (value: Vec3): boolean => value.every((entry) => Math.abs(entry) <= EPSILON);
const isIdentityRotation = isIdentityPosition;
const isIdentityScale = (value: Vec3): boolean =>
  value.every((entry) => Math.abs(entry - 1) <= EPSILON);

const compareVersionParts = (left: string, right: string): number => {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
};

export const supportsJavaMultiAxisRotation = (version: string): boolean =>
  compareVersionParts(version, '1.21.11') >= 0;

const validateResourceLocation = (
  location: MinecraftResourceLocation,
  path: string,
  add: (finding: InvariantFinding) => void
): void => {
  if (!RESOURCE_NAMESPACE_PATTERN.test(location.namespace)) {
    add({
      code: 'format.invalid_namespace',
      severity: 'error',
      message: `Minecraft namespace "${location.namespace}" is invalid.`,
      path: `${path}.namespace`,
      fix: 'Use lowercase letters, digits, underscore, dot, or hyphen.'
    });
  }
  if (
    !RESOURCE_PATH_PATTERN.test(location.path) ||
    location.path.startsWith('/') ||
    location.path.endsWith('/') ||
    location.path.includes('..')
  ) {
    add({
      code: 'format.invalid_resource_path',
      severity: 'error',
      message: `Minecraft resource path "${location.path}" is invalid.`,
      path: `${path}.path`,
      fix: 'Use a relative lowercase resource path without an extension or parent traversal.'
    });
  }
};

const validateVec = (
  value: Vec2 | Vec3 | readonly number[],
  expectedLength: 2 | 3 | 4,
  path: string,
  add: (finding: InvariantFinding) => void,
  entityId?: EntityId
): void => {
  if (!Array.isArray(value) || value.length !== expectedLength) {
    add({
      code: 'value.not_finite',
      severity: 'error',
      message: `Expected a ${expectedLength}-component numeric vector.`,
      path,
      ...(entityId ? { entityIds: [entityId] } : {})
    });
    return;
  }
  value.forEach((entry, index) => {
    if (!isFiniteNumber(entry)) {
      add({
        code: 'value.not_finite',
        severity: 'error',
        message: 'Vector components must be finite numbers.',
        path: `${path}[${index}]`,
        ...(entityId ? { entityIds: [entityId] } : {})
      });
    }
  });
};

const validateTransform = (
  transform: Transform,
  path: string,
  add: (finding: InvariantFinding) => void,
  entityId: EntityId
): void => {
  validateVec(transform.position, 3, `${path}.position`, add, entityId);
  validateVec(transform.rotation, 3, `${path}.rotation`, add, entityId);
  validateVec(transform.scale, 3, `${path}.scale`, add, entityId);
  validateVec(transform.pivot, 3, `${path}.pivot`, add, entityId);
  if (transform.scale.some((entry) => !isFiniteNumber(entry) || Math.abs(entry) <= EPSILON)) {
    add({
      code: 'value.invalid_scale',
      severity: 'error',
      message: 'Scale components must be finite and non-zero.',
      path: `${path}.scale`,
      entityIds: [entityId]
    });
  }
};

const validateCube = (
  cube: CubeNode,
  document: ProjectDocument,
  path: string,
  add: (finding: InvariantFinding) => void
): void => {
  validateVec(cube.bounds.from, 3, `${path}.bounds.from`, add, cube.id);
  validateVec(cube.bounds.to, 3, `${path}.bounds.to`, add, cube.id);
  if (!isFiniteNumber(cube.inflate)) {
    add({
      code: 'value.not_finite',
      severity: 'error',
      message: 'Cube inflate must be finite.',
      path: `${path}.inflate`,
      entityIds: [cube.id]
    });
  }
  if (!COLOR_PATTERN.test(cube.baseColor)) {
    add({
      code: 'cube.invalid_face',
      severity: 'error',
      message: 'Cube baseColor must use six-digit hex.',
      path: `${path}.baseColor`,
      entityIds: [cube.id]
    });
  }

  const positiveAxes = cube.bounds.from.reduce(
    (count, from, index) => count + (cube.bounds.to[index] - from > EPSILON ? 1 : 0),
    0
  );
  const reversedAxis = cube.bounds.from.findIndex((from, index) => cube.bounds.to[index] < from);
  if (reversedAxis >= 0 || positiveAxes < 2) {
    add({
      code: 'cube.invalid_bounds',
      severity: 'error',
      message: 'Cube bounds must not be reversed and must span at least two axes.',
      path: `${path}.bounds`,
      entityIds: [cube.id]
    });
  }

  const faceRecord = cube.faces as Partial<Record<CubeFaceDirection, CubeNode['faces'][CubeFaceDirection]>>;
  for (const direction of CUBE_FACE_DIRECTIONS) {
    const face = faceRecord[direction];
    const facePath = `${path}.faces.${direction}`;
    if (!face) {
      add({
        code: 'cube.invalid_face',
        severity: 'error',
        message: `Cube is missing its ${direction} face record.`,
        path: facePath,
        entityIds: [cube.id]
      });
      continue;
    }
    if (typeof face.enabled !== 'boolean') {
      add({
        code: 'cube.invalid_face',
        severity: 'error',
        message: 'Face enabled must be a boolean.',
        path: `${facePath}.enabled`,
        entityIds: [cube.id]
      });
    }
    if (face.uv) validateVec(face.uv, 4, `${facePath}.uv`, add, cube.id);
    if (
      face.rotation !== undefined &&
      !CUBE_FACE_ROTATIONS.some((rotation) => rotation === face.rotation)
    ) {
      add({
        code: 'cube.invalid_face',
        severity: 'error',
        message: 'Face rotation must be 0, 90, 180, or 270 degrees.',
        path: `${facePath}.rotation`,
        entityIds: [cube.id]
      });
    }
    if (
      face.cullFace !== undefined &&
      !CUBE_FACE_DIRECTION_SET.has(face.cullFace)
    ) {
      add({
        code: 'cube.invalid_face',
        severity: 'error',
        message: 'Face cullFace must be a canonical cube direction.',
        path: `${facePath}.cullFace`,
        entityIds: [cube.id]
      });
    }
    if (face.tintIndex !== undefined && (!Number.isInteger(face.tintIndex) || face.tintIndex < 0)) {
      add({
        code: 'cube.invalid_face',
        severity: 'error',
        message: 'Face tintIndex must be a non-negative integer.',
        path: `${facePath}.tintIndex`,
        entityIds: [cube.id]
      });
    }
    if (face.materialInstance !== undefined && !isNonEmptyString(face.materialInstance)) {
      add({
        code: 'cube.invalid_face',
        severity: 'error',
        message: 'Face materialInstance must be a non-empty string.',
        path: `${facePath}.materialInstance`,
        entityIds: [cube.id]
      });
    }
    if (face.textureId !== null) {
      if (!isNonEmptyString(face.textureId)) {
        add({
          code: 'cube.invalid_face',
          severity: 'error',
          message: 'Face textureId must be a non-empty asset ID or null.',
          path: `${facePath}.textureId`,
          entityIds: [cube.id]
        });
      } else if (face.enabled && !document.textures[face.textureId]) {
        add({
          code: 'cube.texture_missing',
          severity: 'error',
          message: `Face references missing texture "${face.textureId}".`,
          path: `${facePath}.textureId`,
          entityIds: [cube.id],
          assetIds: [face.textureId]
        });
      }
    }
    const faceTexture = typeof face.textureId === 'string'
      ? document.textures[face.textureId]
      : undefined;
    if (
      face.enabled &&
      faceTexture &&
      faceTexture.atlasMode !== 'generate' &&
      face.uv &&
      (
        !Array.isArray(face.uv) ||
        face.uv.length !== 4 ||
        face.uv[0] < 0 ||
        face.uv[0] > faceTexture.width ||
        face.uv[2] < 0 ||
        face.uv[2] > faceTexture.width ||
        face.uv[1] < 0 ||
        face.uv[1] > faceTexture.height ||
        face.uv[3] < 0 ||
        face.uv[3] > faceTexture.height
      )
    ) {
      add({
        code: 'cube.invalid_face',
        severity: 'error',
        message:
          'Preserved face UV endpoints must stay inside the texture canvas.',
        path: `${facePath}.uv`,
        entityIds: [cube.id],
        assetIds: [faceTexture.id]
      });
    }
  }
  if (
    cube.lightEmission !== undefined &&
    (!Number.isInteger(cube.lightEmission) || cube.lightEmission < 0 || cube.lightEmission > 15)
  ) {
    add({
      code: 'cube.invalid_face',
      severity: 'error',
      message: 'Cube lightEmission must be an integer between 0 and 15.',
      path: `${path}.lightEmission`,
      entityIds: [cube.id]
    });
  }
};

const validateMesh = (
  mesh: MeshNode,
  document: ProjectDocument,
  path: string,
  add: (finding: InvariantFinding) => void,
  registerId: (id: string, path: string) => void
): void => {
  for (const [vertexKey, vertex] of Object.entries(mesh.vertices)) {
    const vertexPath = `${path}.vertices.${vertexKey}`;
    registerId(vertex.id, vertexPath);
    if (vertexKey !== vertex.id) {
      add({
        code: 'identity.key_mismatch',
        severity: 'error',
        message: `Vertex map key "${vertexKey}" does not match ID "${vertex.id}".`,
        path: vertexPath,
        entityIds: [mesh.id, vertex.id]
      });
    }
    validateVec(vertex.position, 3, `${vertexPath}.position`, add, mesh.id);
  }

  for (const [faceKey, face] of Object.entries(mesh.faces)) {
    const facePath = `${path}.faces.${faceKey}`;
    registerId(face.id, facePath);
    if (faceKey !== face.id) {
      add({
        code: 'identity.key_mismatch',
        severity: 'error',
        message: `Mesh face map key "${faceKey}" does not match ID "${face.id}".`,
        path: facePath,
        entityIds: [mesh.id, face.id]
      });
    }
    if (face.vertexIds.length < 3) {
      add({
        code: 'mesh.face_too_small',
        severity: 'error',
        message: 'A mesh face requires at least three vertices.',
        path: `${facePath}.vertexIds`,
        entityIds: [mesh.id, face.id]
      });
    }
    if (new Set(face.vertexIds).size !== face.vertexIds.length) {
      add({
        code: 'mesh.face_vertex_duplicate',
        severity: 'error',
        message: 'A mesh face cannot reference the same vertex more than once.',
        path: `${facePath}.vertexIds`,
        entityIds: [mesh.id, face.id]
      });
    }
    for (const vertexId of face.vertexIds) {
      if (!mesh.vertices[vertexId]) {
        add({
          code: 'mesh.vertex_missing',
          severity: 'error',
          message: `Mesh face references missing vertex "${vertexId}".`,
          path: `${facePath}.vertexIds`,
          entityIds: [mesh.id, face.id, vertexId]
        });
      }
    }
    for (const [vertexId, uv] of Object.entries(face.uv)) {
      if (!uv) continue;
      if (!face.vertexIds.includes(vertexId)) {
        add({
          code: 'mesh.uv_vertex_missing',
          severity: 'error',
          message: `UV references vertex "${vertexId}" outside the face.`,
          path: `${facePath}.uv.${vertexId}`,
          entityIds: [mesh.id, face.id, vertexId]
        });
      }
      validateVec(uv, 2, `${facePath}.uv.${vertexId}`, add, mesh.id);
    }
    if (face.textureId !== null && !document.textures[face.textureId]) {
      add({
        code: 'cube.texture_missing',
        severity: 'error',
        message: `Mesh face references missing texture "${face.textureId}".`,
        path: `${facePath}.textureId`,
        entityIds: [mesh.id, face.id],
        assetIds: [face.textureId]
      });
    }
  }
};

const validateAnimationClip = (
  clip: AnimationClip,
  document: ProjectDocument,
  path: string,
  add: (finding: InvariantFinding) => void,
  registerId: (id: string, path: string) => void
): void => {
  if (!isNonEmptyString(clip.name)) {
    add({
      code: 'document.required_value',
      severity: 'error',
      message: 'Animation names must be non-empty.',
      path: `${path}.name`,
      clipIds: [clip.id]
    });
  }
  if (!isFiniteNumber(clip.durationSeconds) || clip.durationSeconds <= 0) {
    add({
      code: 'animation.invalid_timing',
      severity: 'error',
      message: 'Animation duration must be greater than zero.',
      path: `${path}.durationSeconds`,
      clipIds: [clip.id]
    });
  }
  if (!isFiniteNumber(clip.fps) || clip.fps <= 0) {
    add({
      code: 'animation.invalid_timing',
      severity: 'error',
      message: 'Animation FPS must be greater than zero.',
      path: `${path}.fps`,
      clipIds: [clip.id]
    });
  }
  if (!ANIMATION_LOOP_MODES.has(clip.loop)) {
    add({
      code: 'animation.invalid_loop',
      severity: 'error',
      message: 'Animation loop must be once, loop, or hold_on_last_frame.',
      path: `${path}.loop`,
      clipIds: [clip.id]
    });
  }

  const validateScalar = (
    value: AnimationScalar,
    valuePath: string
  ): void => {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        add({
          code: 'animation.invalid_value',
          severity: 'error',
          message: 'Animation numeric values must be finite.',
          path: valuePath,
          clipIds: [clip.id]
        });
      }
      return;
    }
    if (
      typeof value !== 'object' ||
      value === null ||
      value.kind !== 'molang' ||
      !isNonEmptyString(value.source)
    ) {
      add({
        code: 'animation.invalid_value',
        severity: 'error',
        message: 'Animation values must be finite numbers or non-empty Molang expressions.',
        path: valuePath,
        clipIds: [clip.id]
      });
    }
  };
  const validateAnimationVec = (
    value: AnimationVec3,
    valuePath: string
  ): void => {
    if (!Array.isArray(value) || value.length !== 3) {
      add({
        code: 'animation.invalid_value',
        severity: 'error',
        message: 'Animation transforms require a three-component vector.',
        path: valuePath,
        clipIds: [clip.id]
      });
      return;
    }
    value.forEach((component, index) =>
      validateScalar(component, `${valuePath}[${index}]`)
    );
  };
  const validateEasing = (
    easing: KeyframeEasing,
    easingPath: string
  ): void => {
    if (!isNonEmptyString(easing.type)) {
      add({
        code: 'animation.invalid_value',
        severity: 'error',
        message: 'Animation easing types must be non-empty.',
        path: `${easingPath}.type`,
        clipIds: [clip.id]
      });
    }
    easing.arguments?.forEach((argument, index) =>
      validateScalar(argument, `${easingPath}.arguments[${index}]`)
    );
  };
  for (const [field, expression] of [
    ['startDelay', clip.startDelay],
    ['loopDelay', clip.loopDelay],
    ['animationTimeUpdate', clip.animationTimeUpdate]
  ] as const) {
    if (
      expression &&
      (expression.kind !== 'molang' ||
        !isNonEmptyString(expression.source))
    ) {
      add({
        code: 'animation.invalid_value',
        severity: 'error',
        message: `${field} requires a non-empty Molang expression.`,
        path: `${path}.${field}.source`,
        clipIds: [clip.id]
      });
    }
  }
  if (clip.blendWeight !== undefined) {
    validateScalar(clip.blendWeight, `${path}.blendWeight`);
  }
  if (
    clip.overridePreviousAnimation !== undefined &&
    typeof clip.overridePreviousAnimation !== 'boolean'
  ) {
    add({
      code: 'animation.invalid_value',
      severity: 'error',
      message: 'overridePreviousAnimation must be a boolean.',
      path: `${path}.overridePreviousAnimation`,
      clipIds: [clip.id]
    });
  }

  for (const [channelKey, channel] of Object.entries(clip.channels)) {
    const channelPath = `${path}.channels.${channelKey}`;
    registerId(channel.id, channelPath);
    if (channelKey !== channel.id) {
      add({
        code: 'identity.key_mismatch',
        severity: 'error',
        message: `Animation channel key "${channelKey}" does not match ID "${channel.id}".`,
        path: channelPath,
        clipIds: [clip.id]
      });
    }
    if (!document.scene.nodes[channel.targetNodeId]) {
      add({
        code: 'animation.target_missing',
        severity: 'error',
        message: `Animation channel targets missing node "${channel.targetNodeId}".`,
        path: `${channelPath}.targetNodeId`,
        entityIds: [channel.targetNodeId],
        clipIds: [clip.id]
      });
    }
    if (!ANIMATION_PROPERTIES.has(channel.property)) {
      add({
        code: 'animation.invalid_value',
        severity: 'error',
        message: 'Animation channel property must be position, rotation, or scale.',
        path: `${channelPath}.property`,
        clipIds: [clip.id]
      });
    }
    if (
      channel.rotationSpace !== undefined &&
      (channel.property !== 'rotation' ||
        !['bone', 'entity'].includes(channel.rotationSpace))
    ) {
      add({
        code: 'animation.invalid_value',
        severity: 'error',
        message: 'rotationSpace is valid only on rotation channels and must be bone or entity.',
        path: `${channelPath}.rotationSpace`,
        clipIds: [clip.id]
      });
    }
    if (channel.keys.length === 0) {
      add({
        code: 'animation.invalid_timing',
        severity: 'error',
        message: 'Animation transform channels require at least one keyframe.',
        path: `${channelPath}.keys`,
        clipIds: [clip.id]
      });
    }
    let previousTime = -Infinity;
    for (const [keyIndex, keyframe] of channel.keys.entries()) {
      const keyPath = `${channelPath}.keys[${keyIndex}]`;
      registerId(keyframe.id, keyPath);
      validateAnimationVec(keyframe.value, `${keyPath}.value`);
      if (keyframe.preValue) {
        validateAnimationVec(keyframe.preValue, `${keyPath}.preValue`);
      }
      if (keyframe.postValue) {
        validateAnimationVec(keyframe.postValue, `${keyPath}.postValue`);
      }
      if (!ANIMATION_INTERPOLATIONS.has(keyframe.interpolation)) {
        add({
          code: 'animation.invalid_value',
          severity: 'error',
          message: 'Animation interpolation must be linear, step, or catmullrom.',
          path: `${keyPath}.interpolation`,
          clipIds: [clip.id]
        });
      }
      if (keyframe.easing) {
        validateEasing(keyframe.easing, `${keyPath}.easing`);
      }
      if (!isFiniteNumber(keyframe.timeSeconds) || keyframe.timeSeconds < 0 || keyframe.timeSeconds > clip.durationSeconds) {
        add({
          code: 'animation.key_out_of_range',
          severity: 'error',
          message: 'Animation key time must be within the clip duration.',
          path: `${keyPath}.timeSeconds`,
          clipIds: [clip.id]
        });
      }
      if (keyframe.timeSeconds <= previousTime) {
        add({
          code: 'animation.key_order',
          severity: 'error',
          message: 'Animation keys must be strictly ordered by time.',
          path: `${keyPath}.timeSeconds`,
          clipIds: [clip.id]
        });
      }
      previousTime = keyframe.timeSeconds;
    }
  }

  const validateEffect = (
    effect: AnimationEffect,
    effectPath: string,
    trigger: AnimationTriggerTrack
  ): void => {
    if (!isNonEmptyString(effect.effect)) {
      add({
        code: 'animation.invalid_effect',
        severity: 'error',
        message: `${trigger.type} effects require a non-empty effect identifier.`,
        path: `${effectPath}.effect`,
        clipIds: [clip.id]
      });
    }
    if (effect.locatorId !== undefined) {
      const locator = document.scene.nodes[effect.locatorId];
      if (
        !isNonEmptyString(effect.locatorId) ||
        !locator ||
        locator.kind !== 'locator'
      ) {
        add({
          code: 'animation.invalid_effect',
          severity: 'error',
          message: `Effect locator "${effect.locatorId}" does not resolve to a locator node.`,
          path: `${effectPath}.locatorId`,
          entityIds: [effect.locatorId],
          clipIds: [clip.id]
        });
      }
    }
    if (
      effect.preEffectScript &&
      (effect.preEffectScript.kind !== 'molang' ||
        !isNonEmptyString(effect.preEffectScript.source))
    ) {
      add({
        code: 'animation.invalid_effect',
        severity: 'error',
        message: 'Effect pre-script Molang expressions must be non-empty.',
        path: `${effectPath}.preEffectScript.source`,
        clipIds: [clip.id]
      });
    }
  };

  for (const [triggerKey, trigger] of Object.entries(clip.triggers)) {
    const triggerPath = `${path}.triggers.${triggerKey}`;
    registerId(trigger.id, triggerPath);
    if (triggerKey !== trigger.id) {
      add({
        code: 'identity.key_mismatch',
        severity: 'error',
        message: `Animation trigger key "${triggerKey}" does not match ID "${trigger.id}".`,
        path: triggerPath,
        clipIds: [clip.id]
      });
    }
    if (!['sound', 'particle', 'timeline'].includes(trigger.type)) {
      add({
        code: 'animation.invalid_effect',
        severity: 'error',
        message: 'Trigger type must be sound, particle, or timeline.',
        path: `${triggerPath}.type`,
        clipIds: [clip.id]
      });
    }
    if (trigger.keys.length === 0) {
      add({
        code: 'animation.invalid_timing',
        severity: 'error',
        message: 'Animation trigger tracks require at least one keyframe.',
        path: `${triggerPath}.keys`,
        clipIds: [clip.id]
      });
    }
    let previousTime = -Infinity;
    for (const [keyIndex, keyframe] of trigger.keys.entries()) {
      const keyPath = `${triggerPath}.keys[${keyIndex}]`;
      registerId(keyframe.id, keyPath);
      if (trigger.type === 'timeline') {
        const values = Array.isArray(keyframe.value)
          ? keyframe.value
          : [keyframe.value];
        if (
          values.length === 0 ||
          values.some((value) => !isNonEmptyString(value))
        ) {
          add({
            code: 'animation.invalid_effect',
            severity: 'error',
            message: 'Timeline triggers require one or more non-empty expressions.',
            path: `${keyPath}.value`,
            clipIds: [clip.id]
          });
        }
      } else {
        const effects = isAnimationEffectArrayValue(keyframe.value)
          ? keyframe.value
          : isAnimationEffectValue(keyframe.value)
            ? [keyframe.value]
            : [];
        if (effects.length > 0) {
          effects.forEach((effect, effectIndex) =>
            validateEffect(
              effect,
              `${keyPath}.value${
                effects.length > 1 ? `[${effectIndex}]` : ''
              }`,
              trigger
            )
          );
        } else {
          add({
            code: 'animation.invalid_effect',
            severity: 'error',
            message: `${trigger.type} triggers require a structured effect value.`,
            path: `${keyPath}.value`,
            clipIds: [clip.id]
          });
        }
      }
      if (!isFiniteNumber(keyframe.timeSeconds) || keyframe.timeSeconds < 0 || keyframe.timeSeconds > clip.durationSeconds) {
        add({
          code: 'animation.key_out_of_range',
          severity: 'error',
          message: 'Trigger key time must be within the clip duration.',
          path: `${keyPath}.timeSeconds`,
          clipIds: [clip.id]
        });
      }
      if (keyframe.timeSeconds <= previousTime) {
        add({
          code: 'animation.key_order',
          severity: 'error',
          message: 'Trigger keys must be strictly ordered by time.',
          path: `${keyPath}.timeSeconds`,
          clipIds: [clip.id]
        });
      }
      previousTime = keyframe.timeSeconds;
    }
  }
};

const validateJavaProfile = (
  document: ProjectDocument,
  add: (finding: InvariantFinding) => void
): void => {
  const profile = document.formatProfile;
  if (profile.id !== 'minecraft.java_block') return;

  if (!isNonEmptyString(profile.version)) {
    add({
      code: 'document.required_value',
      severity: 'error',
      message: 'Java model format version must be a non-empty string.',
      path: 'formatProfile.version'
    });
  }
  if (!RESOURCE_NAMESPACE_PATTERN.test(profile.namespace)) {
    add({
      code: 'format.invalid_namespace',
      severity: 'error',
      message: `Minecraft namespace "${profile.namespace}" is invalid.`,
      path: 'formatProfile.namespace'
    });
  }
  if (
    !JAVA_MODEL_PATH_PATTERN.test(profile.modelPath) ||
    profile.modelPath.startsWith('/') ||
    profile.modelPath.endsWith('/') ||
    profile.modelPath.includes('..') ||
    profile.modelPath.endsWith('.json')
  ) {
    add({
      code: 'format.invalid_resource_path',
      severity: 'error',
      message: `Java model path "${profile.modelPath}" is invalid.`,
      path: 'formatProfile.modelPath'
    });
  }

  const textureKeys = new Map<string, string>();
  const texturePaths = new Map<string, string>();
  let particleAssetId: string | undefined;
  for (const [assetId, texture] of Object.entries(document.textures)) {
    const path = `textures.${assetId}`;
    if (!texture.minecraft) {
      add({
        code: 'format.texture_binding_missing',
        severity: 'error',
        message: 'Java export requires a Minecraft resource binding for every texture.',
        path: `${path}.minecraft`,
        assetIds: [assetId]
      });
      continue;
    }
    validateResourceLocation(texture.minecraft.resource, `${path}.minecraft.resource`, add);
    if (texture.minecraft.resource.path.endsWith('.png')) {
      add({
        code: 'format.invalid_resource_path',
        severity: 'error',
        message: 'Minecraft texture resource paths must omit the .png extension.',
        path: `${path}.minecraft.resource.path`,
        assetIds: [assetId]
      });
    }
    if (!TEXTURE_KEY_PATTERN.test(texture.minecraft.key)) {
      add({
        code: 'format.invalid_identifier',
        severity: 'error',
        message: `Minecraft texture key "${texture.minecraft.key}" is invalid.`,
        path: `${path}.minecraft.key`,
        assetIds: [assetId],
        fix: 'Use lowercase letters, digits, underscore, dot, or hyphen.'
      });
    }
    const existing = textureKeys.get(texture.minecraft.key);
    if (existing && existing !== assetId) {
      add({
        code: 'format.texture_key_duplicate',
        severity: 'error',
        message: `Minecraft texture key "${texture.minecraft.key}" is used by multiple assets.`,
        path: `${path}.minecraft.key`,
        assetIds: [existing, assetId]
      });
    }
    textureKeys.set(texture.minecraft.key, assetId);
    const texturePath = `${texture.minecraft.resource.namespace}:${texture.minecraft.resource.path}`;
    const existingPath = texturePaths.get(texturePath);
    if (existingPath && existingPath !== assetId) {
      add({
        code: 'format.texture_path_duplicate',
        severity: 'error',
        message: `Java texture output "${texturePath}.png" is used by multiple assets.`,
        path: `${path}.minecraft.resource`,
        assetIds: [existingPath, assetId]
      });
    }
    texturePaths.set(texturePath, assetId);
    if (texture.minecraft.particle) {
      if (particleAssetId) {
        add({
          code: 'format.texture_key_duplicate',
          severity: 'error',
          message: 'Only one Java texture binding may define the particle alias.',
          path: `${path}.minecraft.particle`,
          assetIds: [particleAssetId, assetId]
        });
      }
      particleAssetId = assetId;
    }
    if (texture.source.contentType !== 'image/png' || texture.minecraft.extension !== 'png') {
      add({
        code: 'format.texture_type_unsupported',
        severity: 'error',
        message: 'Java resource-pack textures must be PNG files.',
        path: `${path}.source.contentType`,
        assetIds: [assetId]
      });
    }
  }
  const explicitParticleAsset = textureKeys.get('particle');
  if (particleAssetId && explicitParticleAsset) {
    add({
      code: 'format.texture_key_duplicate',
      severity: 'error',
      message: 'The generated particle alias conflicts with an explicit "particle" texture key.',
      path: `textures.${particleAssetId}.minecraft.particle`,
      assetIds: [explicitParticleAsset, particleAssetId]
    });
  }

  if (Object.keys(document.animations).length > 0) {
    add({
      code: 'format.unsupported_data',
      severity: 'error',
      message: 'Java block/item models cannot contain ashfox animation clips.',
      path: 'animations',
      fix: 'Export a static project revision or choose an animation-capable target.'
    });
  }

  for (const [nodeId, node] of Object.entries(document.scene.nodes)) {
    const path = `scene.nodes.${nodeId}`;
    if (node.kind === 'mesh' || node.kind === 'locator') {
      add({
        code: 'format.unsupported_data',
        severity: 'error',
        message: `Java block/item models do not support ${node.kind} nodes.`,
        path,
        entityIds: [nodeId],
        fix: 'Bake the node into cubes or choose another export target.'
      });
      continue;
    }
    if (node.kind === 'bone') {
      if (
        !isIdentityPosition(node.transform.position) ||
        !isIdentityRotation(node.transform.rotation) ||
        !isIdentityScale(node.transform.scale)
      ) {
        add({
          code: 'format.unbaked_transform',
          severity: 'error',
          message: 'Java block/item export requires bone transforms to be baked into cubes.',
          path: `${path}.transform`,
          entityIds: [nodeId]
        });
      }
      continue;
    }

    if (!isIdentityScale(node.transform.scale)) {
      add({
        code: 'format.unbaked_transform',
        severity: 'error',
        message: 'Java block/item export requires cube scale to be baked into bounds.',
        path: `${path}.transform.scale`,
        entityIds: [nodeId]
      });
    }

    const inflatedFrom = node.bounds.from.map(
      (value, index) => value + node.transform.position[index] - node.inflate
    );
    const inflatedTo = node.bounds.to.map(
      (value, index) => value + node.transform.position[index] + node.inflate
    );
    if (inflatedFrom.some((value, index) => value > inflatedTo[index])) {
      add({
        code: 'cube.invalid_bounds',
        severity: 'error',
        message: 'Java element bounds become reversed after applying inflate.',
        path: `${path}.inflate`,
        entityIds: [nodeId]
      });
    }
    if ([...inflatedFrom, ...inflatedTo].some((value) => value < -16 || value > 32)) {
      add({
        code: 'format.coordinate_overflow',
        severity: 'error',
        message: 'Java block/item element coordinates must remain between -16 and 32 after inflate.',
        path: `${path}.bounds`,
        entityIds: [nodeId]
      });
    }

    const activeRotations = node.transform.rotation.filter((value) => Math.abs(value) > EPSILON);
    if (!supportsJavaMultiAxisRotation(profile.version)) {
      const angle = activeRotations[0] ?? 0;
      if (
        activeRotations.length > 1 ||
        !JAVA_ROTATION_ANGLES.some((allowed) => Math.abs(allowed - angle) <= EPSILON)
      ) {
        add({
          code: 'format.rotation_unsupported',
          severity: 'error',
          message: `Java ${profile.version} supports one rotation axis at -45, -22.5, 0, 22.5, or 45 degrees.`,
          path: `${path}.transform.rotation`,
          entityIds: [nodeId]
        });
      }
    }

    for (const direction of CUBE_FACE_DIRECTIONS) {
      const face = node.faces[direction];
      if (!face.enabled) continue;
      if (face.textureId === null) {
        add({
          code: 'format.texture_binding_missing',
          severity: 'error',
          message: 'Enabled Java faces require a texture.',
          path: `${path}.faces.${direction}.textureId`,
          entityIds: [nodeId]
        });
      }
      if (!face.uv) {
        add({
          code: 'format.uv_missing',
          severity: 'error',
          message: 'Enabled Java faces require an explicit UV rectangle.',
          path: `${path}.faces.${direction}.uv`,
          entityIds: [nodeId]
        });
      }
    }
  }
};

const minecraftTimestampKey = (timeSeconds: number): string =>
  String(Number(timeSeconds.toFixed(4)));

const validateMinecraftActorProfile = (
  document: ProjectDocument,
  add: (finding: InvariantFinding) => void
): void => {
  const profile = document.formatProfile;
  if (
    profile.id !== 'minecraft.bedrock' &&
    profile.id !== 'minecraft.java.geckolib5'
  ) {
    return;
  }
  const targetName =
    profile.id === 'minecraft.bedrock' ? 'Bedrock' : 'GeckoLib 5';
  const geometryVersion =
    profile.id === 'minecraft.bedrock'
      ? profile.version
      : profile.geometryFormatVersion;
  if (
    profile.id === 'minecraft.java.geckolib5' &&
    profile.version !== '5'
  ) {
    add({
      code: 'format.unsupported_data',
      severity: 'error',
      message: 'GeckoLib target version must be 5.',
      path: 'formatProfile.version'
    });
  }
  if (
    profile.id === 'minecraft.java.geckolib5' &&
    !['entity', 'block', 'item'].includes(profile.assetKind)
  ) {
    add({
      code: 'format.unsupported_data',
      severity: 'error',
      message: 'GeckoLib assetKind must be entity, block, or item.',
      path: 'formatProfile.assetKind'
    });
  }
  if (
    profile.id === 'minecraft.bedrock' &&
    !['entity', 'block'].includes(profile.geometryKind)
  ) {
    add({
      code: 'format.unsupported_data',
      severity: 'error',
      message: 'Bedrock geometryKind must be entity or block.',
      path: 'formatProfile.geometryKind'
    });
  }

  if (!isNonEmptyString(geometryVersion)) {
    add({
      code: 'document.required_value',
      severity: 'error',
      message: `${targetName} geometry format version must be a non-empty string.`,
      path:
        profile.id === 'minecraft.bedrock'
          ? 'formatProfile.version'
          : 'formatProfile.geometryFormatVersion'
    });
  }
  if (profile.animationFormatVersion !== '1.8.0') {
    add({
      code: 'format.unsupported_data',
      severity: 'error',
      message: `${targetName} actor animation output requires format version 1.8.0.`,
      path: 'formatProfile.animationFormatVersion'
    });
  }
  if (
    profile.id === 'minecraft.java.geckolib5' &&
    !isNonEmptyString(profile.minecraftVersion)
  ) {
    add({
      code: 'document.required_value',
      severity: 'error',
      message: 'GeckoLib 5 profiles require a Minecraft version.',
      path: 'formatProfile.minecraftVersion'
    });
  }
  if (!RESOURCE_NAMESPACE_PATTERN.test(profile.namespace)) {
    add({
      code: 'format.invalid_namespace',
      severity: 'error',
      message: `${targetName} namespace "${profile.namespace}" is invalid.`,
      path: 'formatProfile.namespace'
    });
  }
  if (
    !RESOURCE_PATH_PATTERN.test(profile.modelPath) ||
    profile.modelPath.startsWith('/') ||
    profile.modelPath.endsWith('/') ||
    profile.modelPath.includes('..') ||
    profile.modelPath.endsWith('.json')
  ) {
    add({
      code: 'format.invalid_resource_path',
      severity: 'error',
      message: `${targetName} model path "${profile.modelPath}" is invalid.`,
      path: 'formatProfile.modelPath'
    });
  }
  if (
    !RESOURCE_PATH_PATTERN.test(profile.animationPath) ||
    profile.animationPath.startsWith('/') ||
    profile.animationPath.endsWith('/') ||
    profile.animationPath.includes('..') ||
    profile.animationPath.endsWith('.json')
  ) {
    add({
      code: 'format.invalid_resource_path',
      severity: 'error',
      message: `${targetName} animation path "${profile.animationPath}" is invalid.`,
      path: 'formatProfile.animationPath'
    });
  }
  if (!BEDROCK_GEOMETRY_IDENTIFIER_PATTERN.test(profile.geometryIdentifier)) {
    add({
      code: 'format.invalid_identifier',
      severity: 'error',
      message: `${targetName} geometry identifiers must start with "geometry." and use lowercase resource characters.`,
      path: 'formatProfile.geometryIdentifier'
    });
  }
  if (profile.visibleBounds) {
    if (
      !isFiniteNumber(profile.visibleBounds.width) ||
      profile.visibleBounds.width <= 0 ||
      !isFiniteNumber(profile.visibleBounds.height) ||
      profile.visibleBounds.height <= 0
    ) {
      add({
        code: 'value.not_finite',
        severity: 'error',
        message: 'Visible bounds width and height must be finite and positive.',
        path: 'formatProfile.visibleBounds'
      });
    }
    validateVec(
      profile.visibleBounds.offset,
      3,
      'formatProfile.visibleBounds.offset',
      add
    );
  }
  if (
    profile.id === 'minecraft.java.geckolib5' &&
    Object.keys(document.animations).length === 0
  ) {
    add({
      code: 'format.unsupported_data',
      severity: 'error',
      message: 'GeckoLib 5 bundles require at least one named animation clip.',
      path: 'animations',
      fix: 'Add an animation clip, including a rest pose clip when the asset is static.'
    });
  }
  const textureCount = Object.keys(document.textures).length;
  if (textureCount === 0) {
    add({
      code: 'format.texture_missing',
      severity: 'warning',
      message:
        `${targetName} project has no texture and is not production ready.`,
      path: 'textures',
      fix:
        'Create a texture explicitly or omit cube textureId to provision the default texture.'
    });
  }

  const boneNames = new Map<string, string>();
  const locatorNames = new Map<string, string>();
  for (const [nodeId, node] of Object.entries(document.scene.nodes)) {
    const path = `scene.nodes.${nodeId}`;
    if (
      node.visible &&
      node.parentId !== null &&
      document.scene.nodes[node.parentId]?.visible === false
    ) {
      add({
        code: 'format.unsupported_data',
        severity: 'error',
        message: `${targetName} cannot export a visible node below a hidden parent bone.`,
        path: `${path}.visible`,
        entityIds: [nodeId, node.parentId]
      });
    }
    if (node.kind === 'mesh') {
      add({
        code: 'format.unsupported_data',
        severity: 'error',
        message: `${targetName} geometry does not support freeform mesh nodes.`,
        path,
        entityIds: [nodeId]
      });
      continue;
    }
    if (node.kind === 'bone') {
      const existing = boneNames.get(node.name);
      if (existing) {
        add({
          code: 'format.invalid_identifier',
          severity: 'error',
          message: `${targetName} bone name "${node.name}" is duplicated.`,
          path: `${path}.name`,
          entityIds: [existing, nodeId]
        });
      }
      boneNames.set(node.name, nodeId);
      if (!isIdentityPosition(node.transform.position) || !isIdentityScale(node.transform.scale)) {
        add({
          code: 'format.unbaked_transform',
          severity: 'error',
          message: `${targetName} bone position and scale must be baked; pivot and rotation remain supported.`,
          path: `${path}.transform`,
          entityIds: [nodeId]
        });
      }
      continue;
    }
    if (node.kind === 'locator') {
      const existing = locatorNames.get(node.name);
      if (existing) {
        add({
          code: 'format.invalid_identifier',
          severity: 'error',
          message: `${targetName} locator name "${node.name}" is duplicated.`,
          path: `${path}.name`,
          entityIds: [existing, nodeId]
        });
      }
      locatorNames.set(node.name, nodeId);
      if (node.parentId === null) {
        add({
          code: 'format.unsupported_data',
          severity: 'error',
          message: `${targetName} locators must be parented to a bone.`,
          path: `${path}.parentId`,
          entityIds: [nodeId]
        });
      }
      if (!isIdentityScale(node.transform.scale)) {
        add({
          code: 'format.unbaked_transform',
          severity: 'error',
          message: `${targetName} locators cannot carry scale.`,
          path: `${path}.transform.scale`,
          entityIds: [nodeId]
        });
      }
      continue;
    }
    if (!isIdentityScale(node.transform.scale)) {
      add({
        code: 'format.unbaked_transform',
        severity: 'error',
        message: `${targetName} cube scale must be baked into bounds.`,
        path: `${path}.transform.scale`,
        entityIds: [nodeId]
      });
    }
    if (node.boxUv && !node.uvOffset) {
      add({
        code: 'format.uv_missing',
        severity: 'error',
        message: `${targetName} box-UV cubes require uvOffset.`,
        path: `${path}.uvOffset`,
        entityIds: [nodeId]
      });
    }
    if (!node.boxUv) {
      for (const direction of CUBE_FACE_DIRECTIONS) {
        const face = node.faces[direction];
        if (face.enabled && !face.uv) {
          add({
            code: 'format.uv_missing',
            severity: 'error',
            message: `Enabled ${targetName} per-face UVs require an explicit rectangle.`,
            path: `${path}.faces.${direction}.uv`,
            entityIds: [nodeId]
          });
        }
      }
    }
    const hasTexturedFace = CUBE_FACE_DIRECTIONS.some((direction) => {
      const face = node.faces[direction];
      return face.enabled && face.textureId !== null;
    });
    if (textureCount > 0 && node.visible && !hasTexturedFace) {
      add({
        code: 'format.texture_missing',
        severity: 'warning',
        message:
          `${targetName} cube "${node.name}" has no texture and will export without visible surface art.`,
        path: `${path}.faces`,
        entityIds: [nodeId],
        fix:
          'Create or generate a texture and bind it to the enabled cube faces.'
      });
    }
  }
  const hasVisibleLooseCube = Object.values(document.scene.nodes).some(
    (node) =>
      node.kind === 'cube' &&
      node.visible &&
      node.parentId === null
  );
  const syntheticCollision = boneNames.get('ashfox_root');
  if (hasVisibleLooseCube && syntheticCollision) {
    add({
      code: 'format.invalid_identifier',
      severity: 'error',
      message: `${targetName} reserves bone name "ashfox_root" when visible root cubes exist.`,
      path: `scene.nodes.${syntheticCollision}.name`,
      entityIds: [syntheticCollision]
    });
  }

  const texturePaths = new Map<string, string>();
  for (const [assetId, texture] of Object.entries(document.textures)) {
    if (!texture.minecraft) {
      add({
        code: 'format.texture_binding_missing',
        severity: 'error',
        message: `${targetName} bundles require a Minecraft resource binding for every texture.`,
        path: `textures.${assetId}.minecraft`,
        assetIds: [assetId]
      });
      continue;
    }
    validateResourceLocation(texture.minecraft.resource, `textures.${assetId}.minecraft.resource`, add);
    if (texture.minecraft.resource.path.endsWith('.png')) {
      add({
        code: 'format.invalid_resource_path',
        severity: 'error',
        message: 'Minecraft texture resource paths must omit the .png extension.',
        path: `textures.${assetId}.minecraft.resource.path`,
        assetIds: [assetId]
      });
    }
    const outputTexturePath =
      profile.id === 'minecraft.java.geckolib5'
        ? `${texture.minecraft.resource.namespace}:${texture.minecraft.resource.path}`
        : texture.minecraft.resource.path;
    const existingPath = texturePaths.get(outputTexturePath);
    if (existingPath && existingPath !== assetId) {
      add({
        code: 'format.texture_path_duplicate',
        severity: 'error',
        message: `${targetName} texture output "${outputTexturePath}.png" is used by multiple assets.`,
        path: `textures.${assetId}.minecraft.resource.path`,
        assetIds: [existingPath, assetId]
      });
    }
    texturePaths.set(outputTexturePath, assetId);
    if (
      texture.source.contentType !== 'image/png' ||
      texture.minecraft.extension !== 'png'
    ) {
      add({
        code: 'format.texture_type_unsupported',
        severity: 'error',
        message: `${targetName} resource textures must be PNG files.`,
        path: `textures.${assetId}.source.contentType`,
        assetIds: [assetId]
      });
    }
  }

  const animationNames = new Map<string, string>();
  for (const [clipId, clip] of Object.entries(document.animations)) {
    const clipPath = `animations.${clipId}`;
    if (!MINECRAFT_ANIMATION_IDENTIFIER_PATTERN.test(clip.name)) {
      add({
        code: 'format.invalid_identifier',
        severity: 'error',
        message: `${targetName} animation names must start with "animation." and use lowercase resource characters.`,
        path: `${clipPath}.name`,
        clipIds: [clipId]
      });
    }
    const existingName = animationNames.get(clip.name);
    if (existingName) {
      add({
        code: 'animation.name_duplicate',
        severity: 'error',
        message: `${targetName} animation name "${clip.name}" is duplicated.`,
        path: `${clipPath}.name`,
        clipIds: [existingName, clipId]
      });
    }
    animationNames.set(clip.name, clipId);

    const targetProperties = new Map<string, string>();
    for (const [channelId, channel] of Object.entries(clip.channels)) {
      const channelPath = `${clipPath}.channels.${channelId}`;
      const target = document.scene.nodes[channel.targetNodeId];
      if (target && target.kind !== 'bone') {
        add({
          code: 'format.unsupported_data',
          severity: 'error',
          message: `${targetName} transform channels may only target bones.`,
          path: `${channelPath}.targetNodeId`,
          entityIds: [channel.targetNodeId],
          clipIds: [clipId]
        });
      } else if (target?.kind === 'bone' && !target.visible) {
        add({
          code: 'format.unsupported_data',
          severity: 'error',
          message: `${targetName} animation channels cannot target a hidden bone.`,
          path: `${channelPath}.targetNodeId`,
          entityIds: [channel.targetNodeId],
          clipIds: [clipId]
        });
      }
      const targetProperty = `${channel.targetNodeId}:${channel.property}`;
      const existingChannel = targetProperties.get(targetProperty);
      if (existingChannel) {
        add({
          code: 'animation.channel_duplicate',
          severity: 'error',
          message: `${targetName} allows one ${channel.property} channel per bone and clip.`,
          path: channelPath,
          clipIds: [clipId]
        });
      }
      targetProperties.set(targetProperty, channelId);

      const timestampKeys = new Set<string>();
      channel.keys.forEach((keyframe, index) => {
        if (!isFiniteNumber(keyframe.timeSeconds)) return;
        const timestamp = minecraftTimestampKey(keyframe.timeSeconds);
        if (timestampKeys.has(timestamp)) {
          add({
            code: 'animation.key_order',
            severity: 'error',
            message: `${targetName} key times collide after four-decimal timestamp normalization.`,
            path: `${channelPath}.keys[${index}].timeSeconds`,
            clipIds: [clipId]
          });
        }
        timestampKeys.add(timestamp);
        if (
          profile.id === 'minecraft.bedrock' &&
          (keyframe.interpolation === 'step' || keyframe.easing)
        ) {
          add({
            code: 'format.unsupported_data',
            severity: 'error',
            message: 'Bedrock actor animation 1.8.0 supports linear or catmullrom keyframes, not GeckoLib easing or STEP.',
            path: `${channelPath}.keys[${index}]`,
            clipIds: [clipId]
          });
        }
      });
    }

    const triggerTimestampKeys = new Map<string, Set<string>>();
    for (const [triggerId, trigger] of Object.entries(clip.triggers)) {
      const keys =
        triggerTimestampKeys.get(trigger.type) ?? new Set<string>();
      trigger.keys.forEach((keyframe, index) => {
        if (!isFiniteNumber(keyframe.timeSeconds)) return;
        const timestamp = minecraftTimestampKey(keyframe.timeSeconds);
        if (keys.has(timestamp)) {
          add({
            code: 'animation.key_order',
            severity: 'error',
            message: `${targetName} ${trigger.type} effects require unique timestamps across tracks.`,
            path: `${clipPath}.triggers.${triggerId}.keys[${index}].timeSeconds`,
            clipIds: [clipId]
          });
        }
        keys.add(timestamp);
        if (
          profile.id === 'minecraft.java.geckolib5' &&
          (trigger.type === 'timeline' ||
            trigger.type === 'sound' ||
            trigger.type === 'particle') &&
          Array.isArray(keyframe.value)
        ) {
          add({
            code: 'format.unsupported_data',
            severity: 'error',
            message: `GeckoLib 5 ${trigger.type} values must be a single entry per timestamp.`,
            path: `${clipPath}.triggers.${triggerId}.keys[${index}].value`,
            clipIds: [clipId]
          });
        }
      });
      triggerTimestampKeys.set(trigger.type, keys);
    }
  }
};

const animationScalarIsMolang = (value: AnimationScalar): boolean =>
  typeof value === 'object' &&
  value !== null &&
  value.kind === 'molang';

const validateGltfProfile = (
  document: ProjectDocument,
  add: (finding: InvariantFinding) => void
): void => {
  const profile = document.formatProfile;
  if (profile.id !== 'gltf.2') return;

  if (profile.version !== '2.0') {
    add({
      code: 'format.unsupported_data',
      severity: 'error',
      message: 'glTF target version must be 2.0.',
      path: 'formatProfile.version'
    });
  }
  if (
    !GLTF_MODEL_PATH_PATTERN.test(profile.modelPath) ||
    profile.modelPath.startsWith('/') ||
    profile.modelPath.endsWith('/') ||
    profile.modelPath.includes('..') ||
    /\.(?:gltf|glb|bin)$/i.test(profile.modelPath)
  ) {
    add({
      code: 'format.invalid_resource_path',
      severity: 'error',
      message: `glTF model path "${profile.modelPath}" is invalid.`,
      path: 'formatProfile.modelPath',
      fix: 'Use a safe relative path without a file extension or parent traversal.'
    });
  }
  if (profile.container !== 'gltf' && profile.container !== 'glb') {
    add({
      code: 'format.unsupported_data',
      severity: 'error',
      message: 'glTF container must be gltf or glb.',
      path: 'formatProfile.container'
    });
  }
  if (
    profile.imageStorage !== 'external' &&
    profile.imageStorage !== 'embedded'
  ) {
    add({
      code: 'format.unsupported_data',
      severity: 'error',
      message: 'glTF image storage must be external or embedded.',
      path: 'formatProfile.imageStorage'
    });
  }
  if (
    profile.imageStorage === 'embedded' &&
    profile.container !== 'glb'
  ) {
    add({
      code: 'format.unsupported_data',
      severity: 'error',
      message: 'Embedded glTF images require the GLB container.',
      path: 'formatProfile.imageStorage',
      fix: 'Use container "glb" or imageStorage "external".'
    });
  }

  for (const [assetId, texture] of Object.entries(document.textures)) {
    if (
      texture.source.contentType !== 'image/png' &&
      texture.source.contentType !== 'image/jpeg'
    ) {
      add({
        code: 'format.texture_type_unsupported',
        severity: 'error',
        message: 'Core glTF 2.0 export supports PNG and JPEG textures.',
        path: `textures.${assetId}.source.contentType`,
        assetIds: [assetId]
      });
    }
    if (
      texture.pbrChannel !== undefined &&
      texture.pbrChannel !== 'color'
    ) {
      add({
        code: 'format.unsupported_data',
        severity: 'error',
        message: 'glTF material export currently accepts color textures; normal, height, and MER bindings require an explicit material channel map.',
        path: `textures.${assetId}.pbrChannel`,
        assetIds: [assetId]
      });
    }
    if (
      texture.renderMode === 'additive' ||
      texture.renderMode === 'layered'
    ) {
      add({
        code: 'format.unsupported_data',
        severity: 'error',
        message: `glTF core cannot preserve the ${texture.renderMode} ashfox render mode.`,
        path: `textures.${assetId}.renderMode`,
        assetIds: [assetId]
      });
    }
    if (texture.colorSpace !== 'srgb') {
      add({
        code: 'format.unsupported_data',
        severity: 'error',
        message: 'glTF base-color and emissive texture export requires sRGB texture data.',
        path: `textures.${assetId}.colorSpace`,
        assetIds: [assetId]
      });
    }
  }

  for (const [nodeId, node] of Object.entries(document.scene.nodes)) {
    const nodePath = `scene.nodes.${nodeId}`;
    if (node.kind === 'cube') {
      if (node.mirror) {
        add({
          code: 'format.unsupported_data',
          severity: 'error',
          message: 'glTF cube export requires mirrored UVs to be baked into explicit face UVs.',
          path: `${nodePath}.mirror`,
          entityIds: [nodeId]
        });
      }
      if (
        node.rescale ||
        node.shade === false ||
        (node.lightEmission !== undefined && node.lightEmission !== 0)
      ) {
        add({
          code: 'format.unsupported_data',
          severity: 'error',
          message: 'glTF cannot preserve Java rescale, disabled shading, or per-cube light emission hints.',
          path: nodePath,
          entityIds: [nodeId]
        });
      }
      for (const direction of CUBE_FACE_DIRECTIONS) {
        const face = node.faces[direction];
        if (!face.enabled) continue;
        if (face.textureId !== null && !face.uv) {
          add({
            code: 'format.uv_missing',
            severity: 'error',
            message: 'Textured glTF cube faces require explicit UV rectangles.',
            path: `${nodePath}.faces.${direction}.uv`,
            entityIds: [nodeId],
            assetIds: [face.textureId]
          });
        }
        if (
          face.tintIndex !== undefined ||
          face.materialInstance !== undefined
        ) {
          add({
            code: 'format.unsupported_data',
            severity: 'error',
            message: 'glTF cannot preserve Minecraft tint indices or material-instance names.',
            path: `${nodePath}.faces.${direction}`,
            entityIds: [nodeId]
          });
        }
      }
    } else if (node.kind === 'mesh') {
      for (const [faceId, face] of Object.entries(node.faces)) {
        if (
          face.textureId !== null &&
          face.vertexIds.some(
            (vertexId) => face.uv[vertexId] === undefined
          )
        ) {
          add({
            code: 'format.uv_missing',
            severity: 'error',
            message: 'Textured glTF mesh faces require a UV for every face vertex.',
            path: `${nodePath}.faces.${faceId}.uv`,
            entityIds: [nodeId, faceId],
            assetIds: [face.textureId]
          });
        }
      }
    }
  }

  for (const [clipId, clip] of Object.entries(document.animations)) {
    const clipPath = `animations.${clipId}`;
    if (Object.keys(clip.channels).length === 0) {
      add({
        code: 'format.unsupported_data',
        severity: 'error',
        message: 'glTF animations require at least one transform channel.',
        path: `${clipPath}.channels`,
        clipIds: [clipId]
      });
    }
    if (
      clip.startDelay ||
      clip.loopDelay ||
      clip.animationTimeUpdate ||
      clip.blendWeight !== undefined ||
      clip.overridePreviousAnimation !== undefined
    ) {
      add({
        code: 'format.unsupported_data',
        severity: 'error',
        message: 'glTF core cannot preserve Minecraft animation timing expressions, blend weight, or override semantics.',
        path: clipPath,
        clipIds: [clipId]
      });
    }
    if (Object.keys(clip.triggers).length > 0) {
      add({
        code: 'format.unsupported_data',
        severity: 'error',
        message: 'Core glTF 2.0 has no sound, particle, or timeline trigger contract.',
        path: `${clipPath}.triggers`,
        clipIds: [clipId],
        fix: 'Remove effect tracks or export the Minecraft actor animation target.'
      });
    }
    const targetProperties = new Map<string, string>();
    for (const [channelId, channel] of Object.entries(clip.channels)) {
      const channelPath = `${clipPath}.channels.${channelId}`;
      const targetProperty = `${channel.targetNodeId}:${channel.property}`;
      if (targetProperties.has(targetProperty)) {
        add({
          code: 'animation.channel_duplicate',
          severity: 'error',
          message: 'glTF allows one animation channel per node transform path.',
          path: channelPath,
          clipIds: [clipId]
        });
      }
      targetProperties.set(targetProperty, channelId);
      if (channel.rotationSpace === 'entity') {
        add({
          code: 'format.unsupported_data',
          severity: 'error',
          message: 'glTF channels use node-local transforms and cannot encode Minecraft entity-relative rotation.',
          path: `${channelPath}.rotationSpace`,
          clipIds: [clipId]
        });
      }

      const interpolation = channel.keys[0]?.interpolation;
      for (const [keyIndex, keyframe] of channel.keys.entries()) {
        const keyPath = `${channelPath}.keys[${keyIndex}]`;
        if (
          interpolation !== undefined &&
          keyframe.interpolation !== interpolation
        ) {
          add({
            code: 'format.unsupported_data',
            severity: 'error',
            message: 'A glTF channel must use one consistent interpolation mode.',
            path: `${keyPath}.interpolation`,
            clipIds: [clipId]
          });
        }
        if (
          keyframe.preValue ||
          keyframe.postValue ||
          keyframe.easing
        ) {
          add({
            code: 'format.unsupported_data',
            severity: 'error',
            message: 'glTF core export does not preserve Minecraft keyframe envelopes or easing.',
            path: keyPath,
            clipIds: [clipId]
          });
        }
        if (
          keyframe.value.some(animationScalarIsMolang) ||
          keyframe.preValue?.some(animationScalarIsMolang) ||
          keyframe.postValue?.some(animationScalarIsMolang) ||
          keyframe.easing?.arguments?.some(animationScalarIsMolang)
        ) {
          add({
            code: 'format.unsupported_data',
            severity: 'error',
            message: 'glTF animation values must be numeric; Molang is Minecraft-specific.',
            path: `${keyPath}.value`,
            clipIds: [clipId]
          });
        }
      }
    }
  }
};

export const validateProjectDocument = (
  document: ProjectDocument,
  options: ValidateProjectOptions = {}
): ValidationReport => {
  const findings: InvariantFinding[] = [];
  const add = (finding: InvariantFinding): void => {
    findings.push(finding);
  };
  const idPaths = new Map<string, string>();
  const registerId = (id: string, path: string): void => {
    if (!isNonEmptyString(id)) {
      add({
        code: 'document.required_value',
        severity: 'error',
        message: 'Addressable IDs must be non-empty strings.',
        path
      });
      return;
    }
    const existing = idPaths.get(id);
    if (existing && existing !== path) {
      add({
        code: 'identity.duplicate',
        severity: 'error',
        message: `ID "${id}" is reused at "${existing}" and "${path}".`,
        path
      });
      return;
    }
    idPaths.set(id, path);
  };

  if (document.schemaVersion !== PROJECT_DOCUMENT_SCHEMA_VERSION) {
    add({
      code: 'document.schema_version',
      severity: 'error',
      message: `Unsupported project schema version "${document.schemaVersion}".`,
      path: 'schemaVersion'
    });
  }
  if (!FORMAT_PROFILE_IDS.has(document.formatProfile.id)) {
    add({
      code: 'format.unsupported_data',
      severity: 'error',
      message: `Unsupported format profile "${String(document.formatProfile.id)}".`,
      path: 'formatProfile.id'
    });
  } else if (
    document.formatProfile.id === 'ashfox.generic' &&
    document.formatProfile.version !== '1'
  ) {
    add({
      code: 'format.unsupported_data',
      severity: 'error',
      message: 'Generic ashfox profile version must be 1.',
      path: 'formatProfile.version'
    });
  }
  for (const [path, value] of [
    ['id', document.id],
    ['name', document.name],
    ['revision', document.revision]
  ] as const) {
    if (!isNonEmptyString(value)) {
      add({
        code: 'document.required_value',
        severity: 'error',
        message: `${path} must be a non-empty string.`,
        path
      });
    }
  }
  for (const [path, value] of [
    ['createdAt', document.createdAt],
    ['updatedAt', document.updatedAt]
  ] as const) {
    if (!isNonEmptyString(value) || Number.isNaN(Date.parse(value))) {
      add({
        code: 'document.invalid_timestamp',
        severity: 'error',
        message: `${path} must be an ISO-compatible timestamp.`,
        path
      });
    }
  }

  const { width, height } = document.settings.textureResolution;
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    add({
      code: 'document.invalid_setting',
      severity: 'error',
      message: 'Texture resolution must use positive integer dimensions.',
      path: 'settings.textureResolution'
    });
  }
  if (!isSurfacePixelDensity(document.settings.surfacePixelDensity)) {
    add({
      code: 'document.invalid_setting',
      severity: 'error',
      message: 'Surface pixel density must be 1, 2, or 4.',
      path: 'settings.surfacePixelDensity'
    });
  }
  const coordinateSystem = document.settings.coordinateSystem;
  if (
    coordinateSystem.up !== 'y' ||
    coordinateSystem.handedness !== 'right' ||
    !['pixel', 'block', 'meter'].includes(coordinateSystem.unit) ||
    coordinateSystem.rotationUnit !== 'degree' ||
    coordinateSystem.rotationOrder !== 'xyz'
  ) {
    add({
      code: 'document.invalid_setting',
      severity: 'error',
      message: 'Projects require right-handed Y-up coordinates, degree XYZ rotations, and pixel, block, or meter units.',
      path: 'settings.coordinateSystem'
    });
  }

  const rootSet = new Set<string>();
  for (const [index, rootId] of document.scene.roots.entries()) {
    if (rootSet.has(rootId)) {
      add({
        code: 'scene.root_duplicate',
        severity: 'error',
        message: `Root "${rootId}" appears more than once.`,
        path: `scene.roots[${index}]`,
        entityIds: [rootId]
      });
    }
    rootSet.add(rootId);
    const root = document.scene.nodes[rootId];
    if (!root) {
      add({
        code: 'scene.root_missing',
        severity: 'error',
        message: `Root "${rootId}" does not resolve to a scene node.`,
        path: `scene.roots[${index}]`,
        entityIds: [rootId]
      });
    } else if (root.parentId !== null) {
      add({
        code: 'scene.root_parent',
        severity: 'error',
        message: 'Root nodes must have parentId set to null.',
        path: `scene.nodes.${rootId}.parentId`,
        entityIds: [rootId]
      });
    }
  }

  for (const [nodeKey, node] of Object.entries(document.scene.nodes)) {
    const path = `scene.nodes.${nodeKey}`;
    registerId(node.id, path);
    if (nodeKey !== node.id) {
      add({
        code: 'identity.key_mismatch',
        severity: 'error',
        message: `Scene map key "${nodeKey}" does not match node ID "${node.id}".`,
        path,
        entityIds: [node.id]
      });
    }
    if (!isNonEmptyString(node.name)) {
      add({
        code: 'document.required_value',
        severity: 'error',
        message: 'Scene node names must be non-empty.',
        path: `${path}.name`,
        entityIds: [node.id]
      });
    }
    validateTransform(node.transform, `${path}.transform`, add, node.id);
    if (
      node.kind === 'locator' &&
      node.ignoreInheritedScale !== undefined &&
      typeof node.ignoreInheritedScale !== 'boolean'
    ) {
      add({
        code: 'document.required_value',
        severity: 'error',
        message: 'Locator ignoreInheritedScale must be a boolean.',
        path: `${path}.ignoreInheritedScale`,
        entityIds: [node.id]
      });
    }
    if (node.parentId === null) {
      if (!rootSet.has(node.id)) {
        add({
          code: 'scene.root_membership',
          severity: 'error',
          message: 'Every parentless node must appear in scene.roots.',
          path: `${path}.parentId`,
          entityIds: [node.id]
        });
      }
    } else {
      const parent = document.scene.nodes[node.parentId];
      if (!parent) {
        add({
          code: 'scene.parent_missing',
          severity: 'error',
          message: `Parent "${node.parentId}" does not exist.`,
          path: `${path}.parentId`,
          entityIds: [node.id, node.parentId]
        });
      } else if (parent.kind !== 'bone') {
        add({
          code: 'scene.parent_not_bone',
          severity: 'error',
          message: 'Scene nodes may only be parented to bones.',
          path: `${path}.parentId`,
          entityIds: [node.id, node.parentId]
        });
      }
      if (rootSet.has(node.id)) {
        add({
          code: 'scene.root_membership',
          severity: 'error',
          message: 'Parented nodes cannot appear in scene.roots.',
          path,
          entityIds: [node.id]
        });
      }
    }

    if (node.kind === 'cube') {
      validateCube(node, document, path, add);
    } else if (node.kind === 'mesh') {
      validateMesh(node, document, path, add, registerId);
    } else if (node.kind !== 'bone' && node.kind !== 'locator') {
      add({
        code: 'scene.invalid_kind',
        severity: 'error',
        message: `Unsupported scene node kind "${String((node as { kind: unknown }).kind)}".`,
        path: `${path}.kind`,
        entityIds: [nodeKey]
      });
    }
  }

  const visitState = new Map<string, 'visiting' | 'visited'>();
  const visitNode = (nodeId: string): void => {
    const state = visitState.get(nodeId);
    if (state === 'visited') return;
    if (state === 'visiting') {
      add({
        code: 'scene.parent_cycle',
        severity: 'error',
        message: `Scene hierarchy contains a cycle at "${nodeId}".`,
        path: `scene.nodes.${nodeId}.parentId`,
        entityIds: [nodeId]
      });
      return;
    }
    visitState.set(nodeId, 'visiting');
    const parentId = document.scene.nodes[nodeId]?.parentId;
    if (parentId && document.scene.nodes[parentId]) visitNode(parentId);
    visitState.set(nodeId, 'visited');
  };
  Object.keys(document.scene.nodes).forEach(visitNode);

  for (const occlusion of findFullyOccludedCubes(document)) {
    add({
      code: 'cube.fully_occluded',
      severity: 'warning',
      message:
        `Cube "${occlusion.innerId}" is completely hidden inside ` +
        `opaque cube "${occlusion.outerId}".`,
      path: `scene.nodes.${occlusion.innerId}.bounds`,
      entityIds: [occlusion.innerId, occlusion.outerId],
      fix:
        'Delete the hidden cube or expose part of it outside the containing cube.'
    });
  }

  const staleTextureIds = staleGeneratedTextureIds(document);
  for (const [assetKey, texture] of Object.entries(document.textures)) {
    const path = `textures.${assetKey}`;
    registerId(texture.id, path);
    if (assetKey !== texture.id) {
      add({
        code: 'identity.key_mismatch',
        severity: 'error',
        message: `Texture map key "${assetKey}" does not match ID "${texture.id}".`,
        path,
        assetIds: [texture.id]
      });
    }
    if (!Number.isInteger(texture.width) || texture.width <= 0 || !Number.isInteger(texture.height) || texture.height <= 0) {
      add({
        code: 'texture.invalid_dimensions',
        severity: 'error',
        message: 'Texture dimensions must be positive integers.',
        path,
        assetIds: [texture.id]
      });
    }
    if (
      texture.atlasMode !== undefined &&
      texture.atlasMode !== 'generate' &&
      texture.atlasMode !== 'preserve'
    ) {
      add({
        code: 'texture.invalid_atlas_mode',
        severity: 'error',
        message: 'Texture atlas mode must be generate or preserve.',
        path: `${path}.atlasMode`,
        assetIds: [texture.id]
      });
    }
    if (
      !isNonEmptyString(texture.source.bucket) ||
      !isNonEmptyString(texture.source.key) ||
      !isNonEmptyString(texture.source.contentType) ||
      !isNonEmptyString(texture.source.contentHash) ||
      (isNonEmptyString(texture.source.bucket) && !isSafeBlobBucket(texture.source.bucket)) ||
      (isNonEmptyString(texture.source.key) && !isSafeBlobKey(texture.source.key)) ||
      (texture.source.byteLength !== undefined &&
        (!Number.isInteger(texture.source.byteLength) || texture.source.byteLength < 0))
    ) {
      add({
        code: 'texture.invalid_blob',
        severity: 'error',
        message: 'Texture blob references require safe logical bucket/key values, contentType, contentHash, and a non-negative byteLength.',
        path: `${path}.source`,
        assetIds: [texture.id]
      });
    }
    if (texture.raster) {
      const canvasDetails = texture.raster.canvasDetails;
      const invalidCanvas =
        !Array.isArray(canvasDetails) ||
        canvasDetails.length > 512 ||
        canvasDetails.some((detail, index) => {
          registerId(detail.id, `${path}.raster.canvasDetails.${index}`);
          return (
            texture.atlasMode === 'generate' ||
            !COLOR_PATTERN.test(detail.color) ||
            !Number.isInteger(detail.x) ||
            !Number.isInteger(detail.y) ||
            !Number.isInteger(detail.width) ||
            !Number.isInteger(detail.height) ||
            detail.x < 0 ||
            detail.y < 0 ||
            detail.width <= 0 ||
            detail.height <= 0 ||
            detail.x + detail.width > texture.width ||
            detail.y + detail.height > texture.height
          );
        });
      if (
        !COLOR_PATTERN.test(texture.raster.background) ||
        invalidCanvas
      ) {
        add({
          code: 'texture.invalid_raster',
          severity: 'error',
          message:
            'Texture raster colors and canvas details must match their ' +
            'atlas mode and dimensions.',
          path: `${path}.raster`,
          assetIds: [texture.id]
        });
      }
    }
    const usesGeneratedTexture =
      texture.atlasMode === 'generate' &&
      Object.values(document.scene.nodes).some(
        (node) =>
          node.kind === 'cube' &&
          CUBE_FACE_DIRECTIONS.some(
            (direction) =>
              node.faces[direction].enabled &&
              node.faces[direction].textureId === texture.id
          )
      );
    if (
      usesGeneratedTexture &&
      staleTextureIds.has(texture.id)
    ) {
      add({
        code: 'texture.recipe_stale',
        severity: 'warning',
        message:
          'Generated texture does not match its canonical derivation.',
        path: 'settings.textureResolution',
        assetIds: [texture.id]
      });
    }
  }

  for (const [clipKey, clip] of Object.entries(document.animations)) {
    const path = `animations.${clipKey}`;
    registerId(clip.id, path);
    if (clipKey !== clip.id) {
      add({
        code: 'identity.key_mismatch',
        severity: 'error',
        message: `Animation map key "${clipKey}" does not match ID "${clip.id}".`,
        path,
        clipIds: [clip.id]
      });
    }
    validateAnimationClip(clip, document, path, add, registerId);
  }

  if (options.includeFormatProfile !== false) {
    validateJavaProfile(document, add);
    validateMinecraftActorProfile(document, add);
    validateGltfProfile(document, add);
  }

  const sortedFindings = findings.sort((left, right) => {
    const pathOrder = left.path.localeCompare(right.path);
    if (pathOrder !== 0) return pathOrder;
    return left.code.localeCompare(right.code);
  });
  return {
    valid: !sortedFindings.some((finding) => finding.severity === 'error'),
    findings: sortedFindings
  };
};

export const assertProjectDocument = (
  document: ProjectDocument,
  options?: ValidateProjectOptions
): void => {
  const report = validateProjectDocument(document, options);
  if (!report.valid) {
    throw new ProjectInvariantError(report);
  }
};
