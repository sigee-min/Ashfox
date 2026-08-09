import {
  intentProgramReviewDigest,
  type CompilationReceipt,
  type IntentProgramSource
} from '@ashfox/engine-core';

/** Full and compact projections of one immutable compiler digest. */
export interface IntentProgramDigestView {
  readonly full: string;
  readonly compact: string;
}

export interface IntentProgramReceiptView {
  readonly compilerVersion: number;
  readonly specificationVersion: number;
  readonly source: IntentProgramDigestView;
  readonly semantics: IntentProgramDigestView;
  readonly output: IntentProgramDigestView;
}

/** Stable presentation boundary for web and inspect consumers. */
export interface IntentProgramAuthorityView {
  readonly version: 1;
  readonly versionLabel: string;
  readonly source: string;
  readonly sourceHash: string;
  readonly reviewDigest: string;
  readonly compactReviewDigest: string;
  readonly receipt: IntentProgramReceiptView;
}

export interface IntentProgramAuthoritySnapshot {
  readonly version: 1;
  readonly source: string;
  readonly sourceHash: string;
  readonly receipt: Readonly<CompilationReceipt>;
}

export const snapshotIntentProgramAuthority = (
  program: IntentProgramSource
): IntentProgramAuthoritySnapshot => ({
  version: program.version,
  source: program.source,
  sourceHash: program.hash,
  receipt: program.receipt
});

export const presentIntentProgramDigest = (
  digest: string
): IntentProgramDigestView => {
  const separator = digest.indexOf(':');
  const algorithm = separator < 0 ? '' : digest.slice(0, separator + 1);
  const fingerprint = separator < 0 ? digest : digest.slice(separator + 1);
  if (fingerprint.length <= 20) return { full: digest, compact: digest };
  return {
    full: digest,
    compact: `${algorithm}${fingerprint.slice(0, 10)}…${fingerprint.slice(-8)}`
  };
};

export const presentIntentProgramAuthority = (
  program: IntentProgramSource
): IntentProgramAuthorityView => {
  const snapshot = snapshotIntentProgramAuthority(program);
  const reviewDigest = intentProgramReviewDigest(program);
  return {
    version: snapshot.version,
    versionLabel: `Intent Program ${snapshot.version}`,
    source: snapshot.source,
    sourceHash: snapshot.sourceHash,
    reviewDigest,
    compactReviewDigest: presentIntentProgramDigest(reviewDigest).compact,
    receipt: {
      compilerVersion: snapshot.receipt.compilerVersion,
      specificationVersion: snapshot.receipt.specificationVersion,
      source: presentIntentProgramDigest(snapshot.receipt.sourceDigest),
      semantics: presentIntentProgramDigest(snapshot.receipt.semanticDigest),
      output: presentIntentProgramDigest(snapshot.receipt.outputDigest)
    }
  };
};
