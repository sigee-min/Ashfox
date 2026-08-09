import {
  isCanonicalIsoDate,
  isClosedContractRecord
} from '@ashfox/internal-contracts';

import { readIntentProgramSource } from '../../provenance/program';
import type { ProjectDocument } from '../../model';
import { validateAnimations } from './animations';
import {
  validateSettings
} from './settings';
import { validateScene } from './scene';
import {
  closedRecord,
  expectFiniteNumber,
  expectString,
  hasOwn,
  reject,
  type ContractContext,
  type ContractRecord
} from './shared';
import { validateTextures } from './textures';
import type { FindingSink } from '../contract';

const validateOptionalAuthorityRecords = (
  record: ContractRecord,
  context: ContractContext
): void => {
  for (const key of [
    'intentProgram',
    'intentProgramProposal',
    'intent',
    'authoringProfile',
    'modeling'
  ] as const) {
    if (!hasOwn(record, key)) continue;
    if (key === 'intentProgram' || key === 'intentProgramProposal') {
      const result = readIntentProgramSource(record[key]);
      if (!result.ok) {
        for (const issue of result.issues) {
          reject(
            context,
            issue.path ? `${key}.${issue.path}` : key,
            issue.message,
            issue.message.startsWith('Unknown ')
              ? 'document.unknown_property'
              : 'document.required_value'
          );
        }
      }
      continue;
    }
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
      'settings',
      'scene',
      'textures',
      'animations',
      'createdAt',
      'updatedAt'
    ],
    [
      'intentProgram',
      'intentProgramProposal',
      'intent',
      'authoringProfile',
      'modeling'
    ],
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
  validateSettings(record.settings, context);
  validateOptionalAuthorityRecords(record, context);
  validateScene(record.scene, context);
  validateTextures(record.textures, context);
  validateAnimations(record.animations, context);
  return context.valid;
};
