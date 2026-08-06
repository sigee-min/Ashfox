import {
  isCanonicalIsoDate,
  isClosedContractRecord
} from '@ashfox/internal-contracts';

import type { ProjectDocument } from '../model';
import { validateAnimations } from './projectDocumentContract/animations';
import {
  validateFormatProfile,
  validateSettings
} from './projectDocumentContract/formatSettings';
import { validateScene } from './projectDocumentContract/scene';
import {
  closedRecord,
  expectFiniteNumber,
  expectString,
  hasOwn,
  reject,
  type ContractContext,
  type ContractRecord
} from './projectDocumentContract/shared';
import { validateTextures } from './projectDocumentContract/textures';
import type { FindingSink } from './types';

const validateOptionalAuthorityRecords = (
  record: ContractRecord,
  context: ContractContext
): void => {
  for (const key of ['intent', 'authoringProfile', 'modeling'] as const) {
    if (!hasOwn(record, key)) continue;
    if (!isClosedContractRecord(record[key])) {
      reject(context, key, `${key} must be an object when present.`);
    }
  }
};

/**
 * Structural authority for the closed ProjectDocument v1 JSON contract.
 * Domain parsers remain authoritative for intent, authoring, and modeling
 * normalization; this guard closes every shared scene/asset/animation shape
 * before semantic validators or compilers receive the document.
 */
export const validateProjectDocumentContract = (
  value: unknown,
  add: FindingSink
): value is ProjectDocument => {
  const context: ContractContext = { add, valid: true };
  const record = closedRecord(
    value,
    '',
    [
      'schemaVersion',
      'id',
      'name',
      'revision',
      'formatProfile',
      'settings',
      'scene',
      'textures',
      'animations',
      'createdAt',
      'updatedAt'
    ],
    ['intent', 'authoringProfile', 'modeling'],
    context
  );
  if (!record) return false;
  expectFiniteNumber(record.schemaVersion, 'schemaVersion', context);
  expectString(record.id, 'id', context);
  expectString(record.name, 'name', context);
  expectString(record.revision, 'revision', context);
  for (const key of ['createdAt', 'updatedAt'] as const) {
    if (!isCanonicalIsoDate(record[key])) {
      reject(
        context,
        key,
        `${key} must be a canonical UTC ISO timestamp.`,
        'document.invalid_timestamp'
      );
    }
  }
  validateFormatProfile(record.formatProfile, context);
  validateSettings(record.settings, context);
  validateOptionalAuthorityRecords(record, context);
  validateScene(record.scene, context);
  validateTextures(record.textures, context);
  validateAnimations(record.animations, context);
  return context.valid;
};
