import {
  isCanonicalIsoDate,
  isClosedContractRecord
} from '@ashfox/internal-contracts';

import type { ProjectDocument } from '../model';
import { validateAnimations } from './projectDocumentContract/animations';
import {
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
  for (const key of [
    'intentProgram',
    'intentProgramProposal',
    'intent',
    'authoringProfile',
    'modeling'
  ] as const) {
    if (!hasOwn(record, key)) continue;
    if (!isClosedContractRecord(record[key])) {
      reject(context, key, `${key} must be an object when present.`);
      continue;
    }
    if (key === 'intentProgram' || key === 'intentProgramProposal') {
      const program = record[key] as ContractRecord;
      const allowed = new Set(['source', 'hash']);
      Object.keys(program).forEach((programKey) => {
        if (!allowed.has(programKey)) {
          reject(context, `${key}.${programKey}`, 'Intent Program records only allow source and hash.');
        }
      });
      expectString(program.source, `${key}.source`, context);
      expectString(program.hash, `${key}.hash`, context);
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
