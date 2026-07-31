import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  isSurfacePixelDensity,
  type ProjectDocument
} from '../model';
import { readProjectIntent } from '../project/projectIntent';
import { isNonEmptyString } from './shared/value';
import type { FindingSink } from './types';

const FORMAT_PROFILE_IDS = new Set<string>([
  'ashfox.generic',
  'minecraft.java_block',
  'minecraft.bedrock',
  'minecraft.java.geckolib5',
  'gltf.2'
]);

const validateIdentityAndTime = (
  document: ProjectDocument,
  add: FindingSink
): void => {
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
};

const validateIntent = (
  document: ProjectDocument,
  add: FindingSink
): void => {
  const result = readProjectIntent(document);
  if (result.ok) return;
  for (const issue of result.issues) {
    add({
      code: 'document.invalid_intent',
      severity: 'error',
      message: issue.message,
      path: issue.path === 'intent' ? issue.path : `intent.${issue.path}`,
      fix: 'Set a normalized intent through project.intent.set.'
    });
  }
};

const validateSettings = (
  document: ProjectDocument,
  add: FindingSink
): void => {
  const { width, height } = document.settings.textureResolution;
  if (
    !Number.isInteger(width) ||
    width <= 0 ||
    !Number.isInteger(height) ||
    height <= 0
  ) {
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
};

export const validateDocument = (
  document: ProjectDocument,
  add: FindingSink
): void => {
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
  validateIdentityAndTime(document, add);
  validateIntent(document, add);
  validateSettings(document, add);
};
