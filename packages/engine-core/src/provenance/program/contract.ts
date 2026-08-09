import {
  INTENT_PROGRAM_COMPILER_VERSION,
  INTENT_PROGRAM_LANGUAGE_VERSION,
  INTENT_PROGRAM_SOURCE_VERSION
} from '../../project/program/language';
import type { IntentProgramSource } from '../../model';

export const INTENT_PROGRAM_SPECIFICATION_VERSION =
  INTENT_PROGRAM_LANGUAGE_VERSION;
export {
  INTENT_PROGRAM_COMPILER_VERSION,
  INTENT_PROGRAM_SOURCE_VERSION
};

export const INTENT_PROGRAM_PROVENANCE_CONTRACT = Object.freeze({
  sourceVersion: INTENT_PROGRAM_SOURCE_VERSION,
  compilerVersion: INTENT_PROGRAM_COMPILER_VERSION,
  specificationVersion: INTENT_PROGRAM_SPECIFICATION_VERSION,
  sourceKeys: Object.freeze(['version', 'source', 'hash', 'receipt'] as const),
  receiptKeys: Object.freeze([
    'sourceDigest',
    'semanticDigest',
    'compilerVersion',
    'specificationVersion',
    'outputDigest'
  ] as const),
  digestKeys: Object.freeze([
    'sourceDigest',
    'semanticDigest',
    'outputDigest'
  ] as const)
});

export interface IntentProgramProvenanceIssue {
  path: string;
  message: string;
}

export type ReadIntentProgramSourceResult =
  | { ok: true; source: IntentProgramSource }
  | { ok: false; issues: readonly IntentProgramProvenanceIssue[] };

export interface IntentProgramSourceReader {
  read(value: unknown): ReadIntentProgramSourceResult;
}

export interface IntentProgramReceiptExpectation {
  source: string;
  semanticCanonical: string;
  outputDigest?: string;
}

export interface IntentProgramRasterProjection {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly sampling: 'nearest' | 'linear';
  readonly colorSpace: 'srgb' | 'linear';
  readonly renderMode: 'default' | 'emissive' | 'additive' | 'layered';
  readonly synthesisVersion: 1;
  readonly rgbaDigest: string;
}
