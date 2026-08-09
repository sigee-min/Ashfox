import { isClosedContractRecord } from '@ashfox/internal-contracts';

import {
  childPath,
  closedRecord,
  expectArray,
  expectBoolean,
  expectFiniteNumber,
  expectLiteral,
  expectString,
  hasOwn,
  reject,
  validateRecordMap,
  type ContractContext
} from './shared';

const validateBlobRef = (
  value: unknown,
  path: string,
  context: ContractContext
): void => {
  const record = closedRecord(
    value,
    path,
    ['bucket', 'key', 'contentType', 'contentHash'],
    ['byteLength'],
    context
  );
  if (!record) return;
  expectString(record.bucket, `${path}.bucket`, context);
  expectString(record.key, `${path}.key`, context);
  expectString(record.contentType, `${path}.contentType`, context);
  expectString(record.contentHash, `${path}.contentHash`, context);
  if (hasOwn(record, 'byteLength')) {
    expectFiniteNumber(record.byteLength, `${path}.byteLength`, context);
  }
};

const validateTextureRaster = (
  value: unknown,
  path: string,
  context: ContractContext
): void => {
  const record = closedRecord(
    value,
    path,
    ['background', 'canvasDetails'],
    [],
    context
  );
  if (!record) return;
  expectString(record.background, `${path}.background`, context);
  const details = expectArray(
    record.canvasDetails,
    `${path}.canvasDetails`,
    context
  );
  details?.forEach((entry, index) => {
    const detailPath = `${path}.canvasDetails[${index}]`;
    const detail = closedRecord(
      entry,
      detailPath,
      ['id', 'color', 'x', 'y', 'width', 'height'],
      [],
      context
    );
    if (!detail) return;
    expectString(detail.id, `${detailPath}.id`, context);
    expectString(detail.color, `${detailPath}.color`, context);
    expectFiniteNumber(detail.x, `${detailPath}.x`, context);
    expectFiniteNumber(detail.y, `${detailPath}.y`, context);
    expectFiniteNumber(detail.width, `${detailPath}.width`, context);
    expectFiniteNumber(detail.height, `${detailPath}.height`, context);
  });
};

const validateTextureMetadata = (
  value: unknown,
  path: string,
  context: ContractContext
): void => {
  if (!isClosedContractRecord(value)) {
    reject(context, path, `${path} must be a scalar metadata map.`);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = childPath(path, key);
    if (
      typeof entry === 'string' ||
      typeof entry === 'boolean' ||
      typeof entry === 'boolean' ||
      (typeof entry === 'number' && Number.isFinite(entry))
    ) {
      continue;
    }
    reject(context, entryPath, `${entryPath} must be a finite JSON scalar.`);
  }
};

const validateTexture = (
  value: unknown,
  path: string,
  context: ContractContext
): void => {
  const record = closedRecord(
    value,
    path,
    [
      'id',
      'name',
      'width',
      'height',
      'source',
      'visible',
      'sampling',
      'colorSpace',
      'renderMode',
      'renderSides'
    ],
    ['atlasMode', 'pbrChannel', 'raster', 'metadata'],
    context
  );
  if (!record) return;
  expectString(record.id, `${path}.id`, context);
  expectString(record.name, `${path}.name`, context);
  expectFiniteNumber(record.width, `${path}.width`, context);
  expectFiniteNumber(record.height, `${path}.height`, context);
  validateBlobRef(record.source, `${path}.source`, context);
  expectBoolean(record.visible, `${path}.visible`, context);
  expectLiteral(
    record.sampling,
    ['nearest', 'linear'],
    `${path}.sampling`,
    context
  );
  expectLiteral(
    record.colorSpace,
    ['srgb', 'linear'],
    `${path}.colorSpace`,
    context
  );
  expectLiteral(
    record.renderMode,
    ['default', 'emissive', 'additive', 'layered'],
    `${path}.renderMode`,
    context
  );
  expectLiteral(
    record.renderSides,
    ['auto', 'front', 'double'],
    `${path}.renderSides`,
    context
  );
  if (hasOwn(record, 'atlasMode')) {
    expectLiteral(
      record.atlasMode,
      ['generate', 'preserve'],
      `${path}.atlasMode`,
      context
    );
  }
  if (hasOwn(record, 'pbrChannel')) {
    expectLiteral(
      record.pbrChannel,
      ['color', 'normal', 'height', 'mer'],
      `${path}.pbrChannel`,
      context
    );
  }
  if (hasOwn(record, 'raster')) {
    validateTextureRaster(record.raster, `${path}.raster`, context);
  }
  if (hasOwn(record, 'metadata')) {
    validateTextureMetadata(record.metadata, `${path}.metadata`, context);
  }
};

export const validateTextures = (
  value: unknown,
  context: ContractContext
): void => {
  validateRecordMap(value, 'textures', context, (entry, path) => {
    validateTexture(entry, path, context);
  });
};
