import type {
  CompilationReceipt,
  IntentProgramSourceV1
} from '../../model';
import {
  INTENT_PROGRAM_PROVENANCE_CONTRACT,
  INTENT_PROGRAM_SOURCE_VERSION,
  type IntentProgramProvenanceIssue,
  type IntentProgramSourceReader,
  type ReadIntentProgramSourceResult
} from './contract';
import { isIntentProgramDigest } from './digest';

type UnknownRecord = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validateClosedKeys = (
  record: UnknownRecord,
  allowed: readonly string[],
  prefix: string,
  issues: IntentProgramProvenanceIssue[]
): void => {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (allowedKeys.has(key)) continue;
    issues.push({
      path: prefix ? `${prefix}.${key}` : key,
      message: `Unknown Intent Program provenance property "${key}".`
    });
  }
};

const readReceipt = (
  value: unknown,
  issues: IntentProgramProvenanceIssue[]
): CompilationReceipt | null => {
  if (!isRecord(value)) {
    issues.push({
      path: 'receipt',
      message: 'Intent Program v1 requires a compilation receipt.'
    });
    return null;
  }
  validateClosedKeys(
    value,
    INTENT_PROGRAM_PROVENANCE_CONTRACT.receiptKeys,
    'receipt',
    issues
  );
  for (const key of INTENT_PROGRAM_PROVENANCE_CONTRACT.digestKeys) {
    if (!isIntentProgramDigest(value[key])) {
      issues.push({
        path: `receipt.${key}`,
        message: `${key} must be a lowercase SHA-256 digest.`
      });
    }
  }
  const compilerVersion = value.compilerVersion;
  if (compilerVersion !== INTENT_PROGRAM_PROVENANCE_CONTRACT.compilerVersion) {
    issues.push({
      path: 'receipt.compilerVersion',
      message: `compilerVersion must be ${INTENT_PROGRAM_PROVENANCE_CONTRACT.compilerVersion}.`
    });
  }
  const specificationVersion = value.specificationVersion;
  if (specificationVersion !== INTENT_PROGRAM_PROVENANCE_CONTRACT.specificationVersion) {
    issues.push({
      path: 'receipt.specificationVersion',
      message: `specificationVersion must be ${INTENT_PROGRAM_PROVENANCE_CONTRACT.specificationVersion}.`
    });
  }
  if (
    !isIntentProgramDigest(value.sourceDigest) ||
    !isIntentProgramDigest(value.semanticDigest) ||
    !isIntentProgramDigest(value.outputDigest) ||
    compilerVersion !== INTENT_PROGRAM_PROVENANCE_CONTRACT.compilerVersion ||
    specificationVersion !== INTENT_PROGRAM_PROVENANCE_CONTRACT.specificationVersion
  ) return null;
  return {
    sourceDigest: value.sourceDigest,
    semanticDigest: value.semanticDigest,
    compilerVersion,
    specificationVersion,
    outputDigest: value.outputDigest
  };
};

export const readIntentProgramSource = (
  value: unknown
): ReadIntentProgramSourceResult => {
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [{ path: '', message: 'Intent Program source must be an object.' }]
    };
  }
  const issues: IntentProgramProvenanceIssue[] = [];
  validateClosedKeys(
    value,
    INTENT_PROGRAM_PROVENANCE_CONTRACT.sourceKeys,
    '',
    issues
  );
  const source = value.source;
  const hash = value.hash;
  if (typeof source !== 'string') {
    issues.push({ path: 'source', message: 'source must be a string.' });
  }
  if (typeof hash !== 'string') {
    issues.push({ path: 'hash', message: 'hash must be a string.' });
  }
  if (typeof source !== 'string' || typeof hash !== 'string') {
    return { ok: false, issues };
  }
  if (value.version !== INTENT_PROGRAM_SOURCE_VERSION) {
    issues.push({
      path: 'version',
      message: `Intent Program version must be ${INTENT_PROGRAM_SOURCE_VERSION}.`
    });
  }
  const receipt = readReceipt(value.receipt, issues);
  if (issues.length > 0 || !receipt) return { ok: false, issues };
  const current: IntentProgramSourceV1 = {
    version: INTENT_PROGRAM_SOURCE_VERSION,
    source,
    hash,
    receipt
  };
  return { ok: true, source: current };
};

export const intentProgramSourceReader: IntentProgramSourceReader =
  Object.freeze({ read: readIntentProgramSource });
