import { canonicalJsonString } from '../../canonicalJson';
import {
  materializeIntentProgram,
  type MaterializeIntentProgramResult
} from '../../compiler/program/materialize';
import type {
  IntentProgramSource,
  ProjectDocument
} from '../../model';
import { intentProgramOutputDigest } from '../../provenance/program';

export interface IntentProgramValidationComputation {
  readonly materialize: (
    document: ProjectDocument,
    source: IntentProgramSource
  ) => MaterializeIntentProgramResult;
  readonly outputDigest: (document: ProjectDocument) => string;
}

export const DEFAULT_INTENT_VALIDATION_COMPUTATION:
  IntentProgramValidationComputation = Object.freeze({
  materialize: materializeIntentProgram,
  outputDigest: intentProgramOutputDigest
});

export interface IntentProgramValidationAttestation {
  readonly candidate: ProjectDocument;
  readonly documentId: string;
  readonly revision: string;
  readonly sourceDigest: string;
  readonly outputDigest: string;
  readonly canonicalSnapshot: string;
}

export interface IntentProgramValidationEvidence {
  readonly outputDigest: string;
}

const issuedAttestations = new WeakSet<
  IntentProgramValidationAttestation
>();

const compilerOwnedProjection = (document: ProjectDocument): unknown => ({
  textureResolution: document.settings.textureResolution,
  intent: document.intent,
  authoringProfile: document.authoringProfile,
  modeling: document.modeling,
  scene: document.scene,
  textures: document.textures,
  animations: document.animations
});

export const compilerOwnedFieldsEqual = (
  document: ProjectDocument,
  expected: ProjectDocument
): boolean => canonicalJsonString(
  compilerOwnedProjection(document)
) === canonicalJsonString(compilerOwnedProjection(expected));

const sharesCompilerOutput = (
  materialized: ProjectDocument,
  candidate: ProjectDocument
): boolean =>
  materialized.id === candidate.id &&
  materialized.revision === candidate.revision &&
  materialized.settings.textureResolution ===
    candidate.settings.textureResolution &&
  materialized.intent === candidate.intent &&
  materialized.authoringProfile === candidate.authoringProfile &&
  materialized.modeling === candidate.modeling &&
  materialized.scene === candidate.scene &&
  materialized.textures === candidate.textures &&
  materialized.animations === candidate.animations;

const canonicalCandidateSnapshot = (
  document: ProjectDocument
): string => canonicalJsonString({
  documentId: document.id,
  revision: document.revision,
  intentProgram: document.intentProgram,
  intentProgramProposal: document.intentProgramProposal,
  compilerOwned: compilerOwnedProjection(document)
});

/** Issues command-local evidence only for the exact materialized candidate. */
export const attestIntentProgramCandidate = (
  materialized: ProjectDocument,
  candidate: ProjectDocument,
  sourceDigest: string,
  outputDigest: string
): IntentProgramValidationAttestation | null => {
  const source = candidate.intentProgram;
  if (
    !source ||
    source.receipt.sourceDigest !== sourceDigest ||
    source.receipt.outputDigest !== outputDigest ||
    !sharesCompilerOutput(materialized, candidate)
  ) return null;
  const attestation = Object.freeze({
    candidate,
    documentId: candidate.id,
    revision: candidate.revision,
    sourceDigest,
    outputDigest,
    canonicalSnapshot: canonicalCandidateSnapshot(candidate)
  });
  issuedAttestations.add(attestation);
  return attestation;
};

/** Accepts issued, exact-reference, unchanged evidence; otherwise use raw IO. */
export const readIntentProgramValidationEvidence = (
  document: ProjectDocument,
  attestation: IntentProgramValidationAttestation | undefined
): IntentProgramValidationEvidence | null => {
  if (
    !attestation ||
    !issuedAttestations.has(attestation) ||
    attestation.candidate !== document ||
    attestation.documentId !== document.id ||
    attestation.revision !== document.revision ||
    attestation.canonicalSnapshot !== canonicalCandidateSnapshot(document)
  ) return null;
  const source = document.intentProgram;
  if (
    !source ||
    source.receipt.sourceDigest !== attestation.sourceDigest ||
    source.receipt.outputDigest !== attestation.outputDigest
  ) return null;
  return Object.freeze({ outputDigest: attestation.outputDigest });
};
