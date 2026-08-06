import { isClosedContractRecord } from '@ashfox/internal-contracts';

import { CUBE_FACE_DIRECTIONS } from '../../model';
import {
  closedRecord,
  expectBoolean,
  expectFiniteNumber,
  expectLiteral,
  expectNullableString,
  expectNumericTuple,
  expectString,
  expectStringArray,
  hasOwn,
  reject,
  validateRecordMap,
  type ContractContext,
  type ContractRecord
} from './shared';

const validateJoint = (
  value: unknown,
  path: string,
  context: ContractContext
): void => {
  if (!isClosedContractRecord(value)) {
    reject(context, path, `${path} must be a joint object.`);
    return;
  }
  if (value.kind === 'hinge') {
    const record = closedRecord(value, path, ['kind', 'axis'], [], context);
    if (record) {
      expectLiteral(record.axis, ['x', 'y', 'z'], `${path}.axis`, context);
    }
    return;
  }
  if (value.kind === 'fixed' || value.kind === 'ball') {
    closedRecord(value, path, ['kind'], [], context);
    return;
  }
  closedRecord(value, path, ['kind'], [], context);
  reject(context, `${path}.kind`, `${path}.kind is not a supported joint.`);
};

const validateTransform = (
  value: unknown,
  path: string,
  context: ContractContext
): void => {
  const record = closedRecord(
    value,
    path,
    ['position', 'rotation', 'scale', 'pivot'],
    [],
    context
  );
  if (!record) return;
  expectNumericTuple(record.position, 3, `${path}.position`, context);
  expectNumericTuple(record.rotation, 3, `${path}.rotation`, context);
  expectNumericTuple(record.scale, 3, `${path}.scale`, context);
  expectNumericTuple(record.pivot, 3, `${path}.pivot`, context);
};

const validateGeneration = (
  value: unknown,
  path: string,
  context: ContractContext
): void => {
  const record = closedRecord(
    value,
    path,
    [
      'authority',
      'role',
      'partId',
      'parentPartId',
      'parentPartId',
      'materialId',
      'primitive',
      'joint'
    ],
    [],
    context
  );
  if (!record) return;
  expectLiteral(
    record.authority,
    ['ashfox.part-compiler'],
    `${path}.authority`,
    context
  );
  expectLiteral(record.role, ['bone', 'geometry'], `${path}.role`, context);
  expectString(record.partId, `${path}.partId`, context);
  expectNullableString(record.parentPartId, `${path}.parentPartId`, context);
  expectString(record.materialId, `${path}.materialId`, context);
  expectLiteral(
    record.primitive,
    ['mass', 'segment', 'plate', 'radial'],
    `${path}.primitive`,
    context
  );
  validateJoint(record.joint, `${path}.joint`, context);
};

const validateCubeFace = (
  value: unknown,
  path: string,
  context: ContractContext
): void => {
  const record = closedRecord(
    value,
    path,
    ['enabled', 'textureId'],
    ['uv', 'rotation', 'cullFace', 'tintIndex', 'materialInstance'],
    context
  );
  if (!record) return;
  expectBoolean(record.enabled, `${path}.enabled`, context);
  expectNullableString(record.textureId, `${path}.textureId`, context);
  if (hasOwn(record, 'uv')) {
    expectNumericTuple(record.uv, 4, `${path}.uv`, context);
  }
  if (hasOwn(record, 'rotation')) {
    expectLiteral(
      record.rotation,
      [0, 90, 180, 270],
      `${path}.rotation`,
      context
    );
  }
  if (hasOwn(record, 'cullFace')) {
    expectLiteral(
      record.cullFace,
      CUBE_FACE_DIRECTIONS,
      `${path}.cullFace`,
      context
    );
  }
  if (hasOwn(record, 'tintIndex')) {
    expectFiniteNumber(record.tintIndex, `${path}.tintIndex`, context);
  }
  if (hasOwn(record, 'materialInstance')) {
    expectString(
      record.materialInstance,
      `${path}.materialInstance`,
      context
    );
  }
};

const validateCubeFaces = (
  value: unknown,
  path: string,
  context: ContractContext
): void => {
  const record = closedRecord(value, path, CUBE_FACE_DIRECTIONS, [], context);
  if (!record) return;
  for (const direction of CUBE_FACE_DIRECTIONS) {
    validateCubeFace(record[direction], `${path}.${direction}`, context);
  }
};

const validateMeshVertex = (
  value: unknown,
  path: string,
  context: ContractContext
): void => {
  const record = closedRecord(value, path, ['id', 'position'], [], context);
  if (!record) return;
  expectString(record.id, `${path}.id`, context);
  expectNumericTuple(record.position, 3, `${path}.position`, context);
};

const validateMeshFace = (
  value: unknown,
  path: string,
  context: ContractContext
): void => {
  const record = closedRecord(
    value,
    path,
    ['id', 'vertexIds', 'uv', 'textureId'],
    [],
    context
  );
  if (!record) return;
  expectString(record.id, `${path}.id`, context);
  expectStringArray(record.vertexIds, `${path}.vertexIds`, context);
  expectNullableString(record.textureId, `${path}.textureId`, context);
  validateRecordMap(record.uv, `${path}.uv`, context, (entry, entryPath) => {
    expectNumericTuple(entry, 2, entryPath, context);
  });
};

const validateUvPolicy = (
  value: unknown,
  path: string,
  context: ContractContext
): void => {
  const record = closedRecord(
    value,
    path,
    [],
    ['symmetryAxis', 'texelDensity', 'padding'],
    context
  );
  if (!record) return;
  if (hasOwn(record, 'symmetryAxis')) {
    expectLiteral(
      record.symmetryAxis,
      ['none', 'x', 'y', 'z'],
      `${path}.symmetryAxis`,
      context
    );
  }
  if (hasOwn(record, 'texelDensity')) {
    expectFiniteNumber(record.texelDensity, `${path}.texelDensity`, context);
  }
  if (hasOwn(record, 'padding')) {
    expectFiniteNumber(record.padding, `${path}.padding`, context);
  }
};

const validateSceneNode = (
  value: unknown,
  path: string,
  context: ContractContext
): void => {
  if (!isClosedContractRecord(value)) {
    reject(context, path, `${path} must be a scene node object.`);
    return;
  }
  const baseRequired = [
    'id',
    'kind',
    'name',
    'parentId',
    'transform',
    'visible'
  ];
  const baseOptional = ['tags', 'generation'];
  let record: ContractRecord | null;
  switch (value.kind) {
    case 'bone':
      record = closedRecord(value, path, baseRequired, baseOptional, context);
      break;
    case 'locator':
      record = closedRecord(
        value,
        path,
        baseRequired,
        [...baseOptional, 'ignoreInheritedScale'],
        context
      );
      break;
    case 'cube':
      record = closedRecord(
        value,
        path,
        [
          ...baseRequired,
          'bounds',
          'inflate',
          'mirror',
          'boxUv',
          'baseColor',
          'faces'
        ],
        [
          ...baseOptional,
          'uvOffset',
          'rescale',
          'shade',
          'lightEmission'
        ],
        context
      );
      break;
    case 'mesh':
      record = closedRecord(
        value,
        path,
        [...baseRequired, 'vertices', 'faces'],
        [...baseOptional, 'uvPolicy'],
        context
      );
      break;
    default:
      record = closedRecord(value, path, baseRequired, baseOptional, context);
      reject(
        context,
        `${path}.kind`,
        `Unsupported scene node kind "${String(value.kind)}".`,
        'scene.invalid_kind'
      );
  }
  if (!record) return;
  expectString(record.id, `${path}.id`, context);
  expectString(record.name, `${path}.name`, context);
  expectNullableString(record.parentId, `${path}.parentId`, context);
  expectBoolean(record.visible, `${path}.visible`, context);
  validateTransform(record.transform, `${path}.transform`, context);
  if (hasOwn(record, 'tags')) {
    expectStringArray(record.tags, `${path}.tags`, context);
  }
  if (hasOwn(record, 'generation')) {
    validateGeneration(record.generation, `${path}.generation`, context);
  }
  if (value.kind === 'locator' && hasOwn(record, 'ignoreInheritedScale')) {
    expectBoolean(
      record.ignoreInheritedScale,
      `${path}.ignoreInheritedScale`,
      context
    );
  }
  if (value.kind === 'cube') {
    const bounds = closedRecord(
      record.bounds,
      `${path}.bounds`,
      ['from', 'to'],
      [],
      context
    );
    if (bounds) {
      expectNumericTuple(bounds.from, 3, `${path}.bounds.from`, context);
      expectNumericTuple(bounds.to, 3, `${path}.bounds.to`, context);
    }
    expectFiniteNumber(record.inflate, `${path}.inflate`, context);
    expectBoolean(record.mirror, `${path}.mirror`, context);
    expectBoolean(record.boxUv, `${path}.boxUv`, context);
    expectString(record.baseColor, `${path}.baseColor`, context);
    validateCubeFaces(record.faces, `${path}.faces`, context);
    if (hasOwn(record, 'uvOffset')) {
      expectNumericTuple(record.uvOffset, 2, `${path}.uvOffset`, context);
    }
    if (hasOwn(record, 'rescale')) {
      expectBoolean(record.rescale, `${path}.rescale`, context);
    }
    if (hasOwn(record, 'shade')) {
      expectBoolean(record.shade, `${path}.shade`, context);
    }
    if (hasOwn(record, 'lightEmission')) {
      expectFiniteNumber(record.lightEmission, `${path}.lightEmission`, context);
    }
  }
  if (value.kind === 'mesh') {
    validateRecordMap(
      record.vertices,
      `${path}.vertices`,
      context,
      (entry, entryPath) => validateMeshVertex(entry, entryPath, context)
    );
    validateRecordMap(
      record.faces,
      `${path}.faces`,
      context,
      (entry, entryPath) => validateMeshFace(entry, entryPath, context)
    );
    if (hasOwn(record, 'uvPolicy')) {
      validateUvPolicy(record.uvPolicy, `${path}.uvPolicy`, context);
    }
  }
};

export const validateScene = (
  value: unknown,
  context: ContractContext
): void => {
  const record = closedRecord(value, 'scene', ['roots', 'nodes'], [], context);
  if (!record) return;
  expectStringArray(record.roots, 'scene.roots', context);
  validateRecordMap(record.nodes, 'scene.nodes', context, (entry, path) => {
    validateSceneNode(entry, path, context);
  });
};
