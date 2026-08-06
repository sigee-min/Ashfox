import { isClosedContractRecord } from '@ashfox/internal-contracts';

import {
  closedRecord,
  expectBoolean,
  expectFiniteNumber,
  expectLiteral,
  expectNumericTuple,
  expectString,
  hasOwn,
  reject,
  type ContractContext,
  type ContractRecord
} from './shared';

const validateVisibleBounds = (
  value: unknown,
  path: string,
  context: ContractContext
): void => {
  const record = closedRecord(
    value,
    path,
    ['width', 'height', 'offset'],
    [],
    context
  );
  if (!record) return;
  expectFiniteNumber(record.width, `${path}.width`, context);
  expectFiniteNumber(record.height, `${path}.height`, context);
  expectNumericTuple(record.offset, 3, `${path}.offset`, context);
};

export const validateFormatProfile = (
  value: unknown,
  context: ContractContext
): void => {
  const path = 'formatProfile';
  if (!isClosedContractRecord(value)) {
    reject(context, path, 'formatProfile must be an object.');
    return;
  }
  if (!expectString(value.id, `${path}.id`, context)) return;
  const commonActorRequired = [
    'id',
    'minecraftVersion',
    'geometryFormatVersion',
    'animationFormatVersion',
    'namespace',
    'modelPath',
    'animationPath',
    'geometryIdentifier'
  ];
  let record: ContractRecord | null = null;
  switch (value.id) {
    case 'ashfox.generic':
      record = closedRecord(value, path, ['id', 'version'], [], context);
      if (record) expectString(record.version, `${path}.version`, context);
      return;
    case 'minecraft.java_block':
      record = closedRecord(
        value,
        path,
        [
          'id',
          'minecraftVersion',
          'resourcePackFormat',
          'namespace',
          'modelPath',
          'modelKind'
        ],
        ['parent', 'ambientOcclusion', 'guiLight'],
        context
      );
      if (!record) return;
      expectString(record.minecraftVersion, `${path}.minecraftVersion`, context);
      expectFiniteNumber(
        record.resourcePackFormat,
        `${path}.resourcePackFormat`,
        context
      );
      expectString(record.namespace, `${path}.namespace`, context);
      expectString(record.modelPath, `${path}.modelPath`, context);
      expectLiteral(record.modelKind, ['block'], `${path}.modelKind`, context);
      if (hasOwn(record, 'parent')) {
        expectString(record.parent, `${path}.parent`, context);
      }
      if (hasOwn(record, 'ambientOcclusion')) {
        expectBoolean(
          record.ambientOcclusion,
          `${path}.ambientOcclusion`,
          context
        );
      }
      if (hasOwn(record, 'guiLight')) {
        expectLiteral(
          record.guiLight,
          ['front', 'side'],
          `${path}.guiLight`,
          context
        );
      }
      return;
    case 'minecraft.bedrock':
      record = closedRecord(
        value,
        path,
        [...commonActorRequired, 'geometryKind'],
        ['visibleBounds'],
        context
      );
      if (!record) return;
      expectString(record.minecraftVersion, `${path}.minecraftVersion`, context);
      expectString(
        record.geometryFormatVersion,
        `${path}.geometryFormatVersion`,
        context
      );
      expectString(
        record.animationFormatVersion,
        `${path}.animationFormatVersion`,
        context
      );
      expectString(record.namespace, `${path}.namespace`, context);
      expectString(record.modelPath, `${path}.modelPath`, context);
      expectString(record.animationPath, `${path}.animationPath`, context);
      expectLiteral(
        record.geometryKind,
        ['entity', 'block'],
        `${path}.geometryKind`,
        context
      );
      expectString(
        record.geometryIdentifier,
        `${path}.geometryIdentifier`,
        context
      );
      if (hasOwn(record, 'visibleBounds')) {
        validateVisibleBounds(
          record.visibleBounds,
          `${path}.visibleBounds`,
          context
        );
      }
      return;
    case 'minecraft.java.geckolib5':
      record = closedRecord(
        value,
        path,
        [...commonActorRequired, 'version', 'assetKind'],
        ['visibleBounds'],
        context
      );
      if (!record) return;
      expectString(record.version, `${path}.version`, context);
      expectString(record.minecraftVersion, `${path}.minecraftVersion`, context);
      expectString(
        record.geometryFormatVersion,
        `${path}.geometryFormatVersion`,
        context
      );
      expectString(
        record.animationFormatVersion,
        `${path}.animationFormatVersion`,
        context
      );
      expectString(record.namespace, `${path}.namespace`, context);
      expectLiteral(
        record.assetKind,
        ['entity', 'block', 'item'],
        `${path}.assetKind`,
        context
      );
      expectString(record.modelPath, `${path}.modelPath`, context);
      expectString(record.animationPath, `${path}.animationPath`, context);
      expectString(
        record.geometryIdentifier,
        `${path}.geometryIdentifier`,
        context
      );
      if (hasOwn(record, 'visibleBounds')) {
        validateVisibleBounds(
          record.visibleBounds,
          `${path}.visibleBounds`,
          context
        );
      }
      return;
    case 'gltf.2':
      record = closedRecord(
        value,
        path,
        ['id', 'version', 'container', 'imageStorage', 'modelPath'],
        ['copyright'],
        context
      );
      if (!record) return;
      expectString(record.version, `${path}.version`, context);
      expectLiteral(
        record.container,
        ['gltf', 'glb'],
        `${path}.container`,
        context
      );
      expectLiteral(
        record.imageStorage,
        ['external', 'embedded'],
        `${path}.imageStorage`,
        context
      );
      expectString(record.modelPath, `${path}.modelPath`, context);
      if (hasOwn(record, 'copyright')) {
        expectString(record.copyright, `${path}.copyright`, context);
      }
      return;
    default:
      reject(
        context,
        `${path}.id`,
        `Unsupported format profile "${value.id}".`,
        'format.unsupported_data'
      );
  }
};

export const validateSettings = (
  value: unknown,
  context: ContractContext
): void => {
  const record = closedRecord(
    value,
    'settings',
    ['textureResolution', 'surfacePixelDensity', 'coordinateSystem'],
    [],
    context
  );
  if (!record) return;
  const resolution = closedRecord(
    record.textureResolution,
    'settings.textureResolution',
    ['width', 'height'],
    [],
    context
  );
  if (resolution) {
    expectFiniteNumber(
      resolution.width,
      'settings.textureResolution.width',
      context
    );
    expectFiniteNumber(
      resolution.height,
      'settings.textureResolution.height',
      context
    );
  }
  expectFiniteNumber(
    record.surfacePixelDensity,
    'settings.surfacePixelDensity',
    context
  );
  const coordinates = closedRecord(
    record.coordinateSystem,
    'settings.coordinateSystem',
    ['up', 'handedness', 'unit', 'rotationUnit', 'rotationOrder'],
    [],
    context
  );
  if (!coordinates) return;
  expectLiteral(coordinates.up, ['y'], 'settings.coordinateSystem.up', context);
  expectLiteral(
    coordinates.handedness,
    ['right'],
    'settings.coordinateSystem.handedness',
    context
  );
  expectLiteral(
    coordinates.unit,
    ['pixel', 'block', 'meter'],
    'settings.coordinateSystem.unit',
    context
  );
  expectLiteral(
    coordinates.rotationUnit,
    ['degree'],
    'settings.coordinateSystem.rotationUnit',
    context
  );
  expectLiteral(
    coordinates.rotationOrder,
    ['xyz'],
    'settings.coordinateSystem.rotationOrder',
    context
  );
};
