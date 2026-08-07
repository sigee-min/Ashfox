import {
  isCurrentInternalContractVersion
} from '@ashfox/internal-contracts';

import {
  ASHFOX_GENERIC_FORMAT_VERSION,
  isSurfacePixelDensity,
  type ProjectDocument
} from '../model';
import {
  readAuthoringProfile
} from '../authoring/authoringProfile';
import { readProjectIntent } from '../project/projectIntent';
import { isNonEmptyString } from './shared/value';
import type { FindingSink } from './types';

const validateIdentity = (
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

const validateAuthoringProfile = (
  document: ProjectDocument,
  add: FindingSink
): void => {
  const result = readAuthoringProfile(document);
  if (result.ok) return;
  for (const issue of result.issues) {
    add({
      code: 'document.invalid_authoring_profile',
      severity: 'error',
      message: issue.message,
      path:
        issue.path === 'authoringProfile' ||
        issue.path.startsWith('authoringProfile.')
          ? issue.path
          : `authoringProfile.${issue.path}`,
      fix:
        'Replace the profile through project.authoring.configure using the current explicit v2 module-graph contract.'
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
  if (!isCurrentInternalContractVersion(
    'projectDocument',
    document.schemaVersion
  )) {
    add({
      code: 'document.schema_version',
      severity: 'error',
      message: `Unsupported project schema version "${document.schemaVersion}".`,
      path: 'schemaVersion'
    });
  }
  if (
    document.formatProfile.id === 'ashfox.generic' &&
    document.formatProfile.version !== ASHFOX_GENERIC_FORMAT_VERSION
  ) {
    add({
      code: 'format.unsupported_data',
      severity: 'error',
      message:
        `Generic ashfox profile version must be ${ASHFOX_GENERIC_FORMAT_VERSION}.`,
      path: 'formatProfile.version'
    });
  }
  validateIdentity(document, add);
  validateIntent(document, add);
  validateAuthoringProfile(document, add);
  validateSettings(document, add);
};
