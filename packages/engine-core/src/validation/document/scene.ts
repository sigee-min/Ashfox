import { isClosedContractRecord } from '@ashfox/internal-contracts';

import {
  CUBE_FACE_DIRECTIONS,
  PLANE_FACE_DIRECTIONS
} from '../../model';
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

const validatePlaneBasis = (
  value: unknown,
  path: string,
  context: ContractContext
): void => {
  const record = closedRecord(value, path,
    ['normal', 'uAxis', 'vAxis', 'orientation'], [], context);
  if (!record) return;
  expectNumericTuple(record.normal, 3, `${path}.normal`, context);
  expectNumericTuple(record.uAxis, 3, `${path}.uAxis`, context);
  expectNumericTuple(record.vAxis, 3, `${path}.vAxis`, context);
  expectLiteral(record.orientation,
    ['normal', 'mirror-u', 'mirror-v', 'rotate-90'],
    `${path}.orientation`, context);
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

const validatePlaneFaces = (
  value: unknown,
  path: string,
  context: ContractContext
): void => {
  const record = closedRecord(value, path, PLANE_FACE_DIRECTIONS, [], context);
  if (!record) return;
  for (const direction of PLANE_FACE_DIRECTIONS) {
    validateCubeFace(record[direction], `${path}.${direction}`, context);
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
  const baseOptional = ['tags'];
  let record: ContractRecord | null;
  switch (value.kind) {
    case 'bone':
      record = closedRecord(value, path, baseRequired,
        [...baseOptional, 'canonicalFrame'], context);
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
      record = value.geometryMode === 'axis-box'
        ? closedRecord(value, path, [...baseRequired, 'geometryMode', 'bounds',
          'inflate', 'mirror', 'boxUv', 'faces'],
        [...baseOptional, 'uvOffset', 'rescale', 'shade', 'lightEmission'], context)
        : value.geometryMode === 'oriented-box'
          ? closedRecord(value, path, [...baseRequired, 'geometryMode',
            'orientedBox', 'inflate', 'mirror', 'boxUv', 'faces'],
          [...baseOptional, 'uvOffset', 'rescale', 'shade', 'lightEmission'], context)
          : (reject(context, `${path}.geometryMode`,
            'Cube geometryMode must be axis-box or oriented-box.',
            'scene.invalid_kind'), null);
      break;
    case 'plane':
      record = closedRecord(
        value,
        path,
        [
          ...baseRequired,
          'size',
          'sidedness',
          'coverageId',
          'faces'
        ],
        [...baseOptional, 'basis'],
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
  if (value.kind === 'bone' && hasOwn(record, 'canonicalFrame')) {
    const frame = closedRecord(record.canonicalFrame,
      `${path}.canonicalFrame`,
        ['origin', 'xAxis', 'yAxis', 'zAxis', 'determinant', 'rotation'], [], context);
    if (frame) {
      for (const axis of ['origin', 'xAxis', 'yAxis', 'zAxis'] as const) {
        expectNumericTuple(frame[axis], 3, `${path}.canonicalFrame.${axis}`,
          context);
      }
      expectNumericTuple(frame.rotation, 3,
        `${path}.canonicalFrame.rotation`, context);
      if (frame.determinant !== 1 && frame.determinant !== -1) reject(context,
        `${path}.canonicalFrame.determinant`,
        `${path}.canonicalFrame.determinant must be 1 or -1.`);
    }
  }
  if (value.kind === 'locator' && hasOwn(record, 'ignoreInheritedScale')) {
    expectBoolean(
      record.ignoreInheritedScale,
      `${path}.ignoreInheritedScale`,
      context
    );
  }
  if (value.kind === 'cube') {
    expectString(record.geometryMode, `${path}.geometryMode`, context);
    if (record.geometryMode === 'axis-box') {
      const bounds = closedRecord(record.bounds, `${path}.bounds`,
        ['from', 'to'], [], context);
      if (bounds) {
        expectNumericTuple(bounds.from, 3, `${path}.bounds.from`, context);
        expectNumericTuple(bounds.to, 3, `${path}.bounds.to`, context);
      }
    } else if (record.geometryMode === 'oriented-box') {
      const oriented = closedRecord(record.orientedBox, `${path}.orientedBox`,
        ['unrotatedFrom', 'unrotatedTo', 'pivot', 'rotation',
          'cornerDenominator', 'cornerNumerators', 'cornerDigest',
          'faceChartDigest', 'coverProofDigest'], [], context);
      if (oriented) {
        expectNumericTuple(oriented.unrotatedFrom, 3,
          `${path}.orientedBox.unrotatedFrom`, context);
        expectNumericTuple(oriented.unrotatedTo, 3,
          `${path}.orientedBox.unrotatedTo`, context);
        expectNumericTuple(oriented.pivot, 3,
          `${path}.orientedBox.pivot`, context);
        const rotation = closedRecord(oriented.rotation,
          `${path}.orientedBox.rotation`, ['axis', 'angle22_5Units'], [], context);
        if (rotation) {
          if (!['x', 'y', 'z'].includes(String(rotation.axis))) reject(context,
            `${path}.orientedBox.rotation.axis`, 'Oriented axis must be x, y, or z.');
          if (![-2, -1, 1, 2].includes(Number(rotation.angle22_5Units))) reject(
            context, `${path}.orientedBox.rotation.angle22_5Units`,
            'Oriented rotation must be a supported 22.5-degree tick.');
        }
        expectFiniteNumber(oriented.cornerDenominator,
          `${path}.orientedBox.cornerDenominator`, context);
        if (!Array.isArray(oriented.cornerNumerators) ||
          oriented.cornerNumerators.length !== 8 ||
          oriented.cornerNumerators.some((corner) => !Array.isArray(corner) ||
            corner.length !== 3 || corner.some((entry) => typeof entry !== 'string'))) {
          reject(context, `${path}.orientedBox.cornerNumerators`,
            'Oriented box must carry eight exact string corner tuples.');
        }
        for (const key of ['cornerDigest', 'faceChartDigest',
          'coverProofDigest'] as const) expectString(oriented[key],
          `${path}.orientedBox.${key}`, context);
      }
    }
    expectFiniteNumber(record.inflate, `${path}.inflate`, context);
    expectBoolean(record.mirror, `${path}.mirror`, context);
    expectBoolean(record.boxUv, `${path}.boxUv`, context);
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
  if (value.kind === 'plane') {
    if (hasOwn(record, 'basis')) {
      validatePlaneBasis(record.basis, `${path}.basis`, context);
    }
    expectNumericTuple(record.size, 2, `${path}.size`, context);
    expectLiteral(
      record.sidedness,
      ['front', 'double'],
      `${path}.sidedness`,
      context
    );
    expectString(record.coverageId, `${path}.coverageId`, context);
    validatePlaneFaces(record.faces, `${path}.faces`, context);
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
