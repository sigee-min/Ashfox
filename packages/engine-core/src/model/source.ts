import type {
  INTENT_PROGRAM_COMPILER_VERSION,
  INTENT_PROGRAM_LANGUAGE_VERSION,
  INTENT_PROGRAM_SOURCE_VERSION
} from '../project/program/language';

export interface CompilationReceipt {
  /** SHA-256 of the exact staged source text. */
  readonly sourceDigest: string;
  /** SHA-256 of the normalized semantic program. */
  readonly semanticDigest: string;
  readonly compilerVersion: typeof INTENT_PROGRAM_COMPILER_VERSION;
  readonly specificationVersion: typeof INTENT_PROGRAM_LANGUAGE_VERSION;
  /** SHA-256 of every compiler-owned output field. */
  readonly outputDigest: string;
}

/** Persisted, receipt-bound Intent Program v1 source authority. */
export interface IntentProgramSourceV1 {
  readonly version: typeof INTENT_PROGRAM_SOURCE_VERSION;
  readonly source: string;
  readonly hash: string;
  readonly receipt: CompilationReceipt;
}

/** Intent Program 1 is the only current source contract. */
export type IntentProgramSource = IntentProgramSourceV1;
