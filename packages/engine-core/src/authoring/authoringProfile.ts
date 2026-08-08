import {
  hasExactContractKeys,
  isClosedContractRecord,
  isCurrentInternalContractVersion,
  isNonEmptyContractText,
  isUniqueContractTextArray
} from '@ashfox/internal-contracts';

import { canonicalJsonString } from '../canonicalJson';
import type { ProjectDocument } from '../model';
import { evaluateAuthoringCompatibility } from './compatibilityEvaluator';
import {
  resolveArchetypeReference,
  resolveSpecialistReference
} from './authoringRegistry';
import {
  addAuthoringProfileIssue as addIssue,
  readArchetypeReference,
  readClaims,
  readSpecialists,
  type AuthoringProfileIssue
} from './authoringEvidence';
import { readAuthoringBindings } from './authoringProfileBindings';
import { readAuthoringCoverage } from './authoringProfileCoverage';
import { readAuthoringFace } from './authoringProfileFace';
import { readAuthoringSlots } from './authoringProfileSlots';
import { authoringRoutingSnapshot } from './authoringRouting';
import {
  AUTHORING_FACE_MODES,
  AUTHORING_PROFILE_SCHEMA_VERSION,
  AUTHORING_ROUTING_CONTRACT_VERSION,
  AUTHORING_TRACKS,
  type ArchetypeDefinition,
  type AuthoringFaceMode,
  type AuthoringProfile,
  type AuthoringRoutingSnapshot,
  type AuthoringSelectionInput,
  type AuthoringTrack,
  type SpecialistDefinition
} from './authoringTypes';

export {
  AUTHORING_PROFILE_LIMITS,
  type AuthoringProfileIssue
} from './authoringEvidence';

export type NormalizeAuthoringProfileResult =
  | { ok: true; profile: AuthoringProfile }
  | { ok: false; issues: readonly AuthoringProfileIssue[] };

export type ReadAuthoringProfileResult =
  | { ok: true; profile: AuthoringProfile | null }
  | { ok: false; issues: readonly AuthoringProfileIssue[] };

type AuthoringContext = Pick<
  ProjectDocument,
  'intent' | 'formatProfile'
>;

const PROFILE_KEYS = new Set([
  'schemaVersion',
  'archetype',
  'track',
  'faceMode',
  'face',
  'specialists',
  'claims',
  'routing',
  'slots',
  'coverage',
  'bindings'
]);
const SELECTION_KEYS = new Set([
  'archetype',
  'track',
  'faceMode',
  'face',
  'specialists',
  'claims',
  'slots',
  'coverage',
  'bindings'
]);
const ROUTING_KEYS = new Set([
  'contractVersion',
  'animationSupported',
  'canonicalInput',
  'referenceIds'
]);
const TRACKS = new Set<string>(AUTHORING_TRACKS);
const FACE_MODES = new Set<string>(AUTHORING_FACE_MODES);

const failure = (
  path: string,
  message: string,
  expected: string
): NormalizeAuthoringProfileResult => ({
  ok: false,
  issues: [{ path, message, expected }]
});

const readRouting = (
  value: unknown,
  issues: AuthoringProfileIssue[]
): AuthoringRoutingSnapshot | null => {
  if (
    !isClosedContractRecord(value) ||
    !hasExactContractKeys(value, ROUTING_KEYS) ||
    !isCurrentInternalContractVersion(
      'authoringRouting',
      value.contractVersion
    ) ||
    typeof value.animationSupported !== 'boolean' ||
    !isNonEmptyContractText(value.canonicalInput) ||
    !isUniqueContractTextArray(value.referenceIds)
  ) {
    addIssue(
      issues,
      'routing',
      'Routing snapshot must use the complete current routing contract.',
      '{contractVersion:1,animationSupported,canonicalInput,referenceIds}'
    );
    return null;
  }
  return {
    contractVersion: AUTHORING_ROUTING_CONTRACT_VERSION,
    animationSupported: value.animationSupported,
    canonicalInput: value.canonicalInput,
    referenceIds: [...value.referenceIds].sort((left, right) =>
      left.localeCompare(right)
    )
  };
};

const normalizeProfileRecord = (
  value: Readonly<Record<string, unknown>>,
  context: AuthoringContext | undefined,
  issues: AuthoringProfileIssue[]
): AuthoringProfile | null => {
  const archetypeReference = readArchetypeReference(
    value.archetype,
    'archetype',
    issues
  );
  const specialists = readSpecialists(value.specialists, issues);
  const selectedAuthorities = new Map<
    string,
    ArchetypeDefinition | SpecialistDefinition
  >();
  if (archetypeReference) {
    const definition = resolveArchetypeReference(archetypeReference);
    if (definition) selectedAuthorities.set(definition.id, definition);
  }
  for (const reference of specialists ?? []) {
    const definition = resolveSpecialistReference(reference);
    if (definition) selectedAuthorities.set(definition.id, definition);
  }
  const claims = readClaims(
    value.claims,
    selectedAuthorities,
    context?.intent,
    issues
  );
  const routing = readRouting(value.routing, issues);
  const track = typeof value.track === 'string' && TRACKS.has(value.track)
    ? value.track as AuthoringTrack
    : null;
  if (track === null) {
    addIssue(
      issues,
      'track',
      `Unknown authoring quality track "${String(value.track)}".`,
      AUTHORING_TRACKS.join(' | ')
    );
  }
  const faceMode = typeof value.faceMode === 'string' &&
    FACE_MODES.has(value.faceMode)
    ? value.faceMode as AuthoringFaceMode
    : null;
  if (faceMode === null) {
    addIssue(
      issues,
      'faceMode',
      `Unknown authoring face mode "${String(value.faceMode)}".`,
      AUTHORING_FACE_MODES.join(' | ')
    );
  }
  const archetype = archetypeReference
    ? resolveArchetypeReference(archetypeReference)
    : undefined;
  const slots = readAuthoringSlots(
    value.slots,
    archetype,
    context?.intent,
    issues
  );
  const face = readAuthoringFace(
    value.face,
    faceMode,
    track,
    slots ?? [],
    context?.intent,
    issues
  );
  const coverage = readAuthoringCoverage(
    value.coverage,
    context?.intent,
    slots ?? [],
    track,
    issues
  );
  const bindings = readAuthoringBindings(
    value.bindings,
    specialists ?? [],
    issues
  );
  if (
    !archetypeReference ||
    !specialists ||
    !claims ||
    !routing ||
    !track ||
    !faceMode ||
    (faceMode === 'full' && !face) ||
    !slots ||
    !coverage ||
    !bindings ||
    issues.length > 0
  ) {
    return null;
  }
  const profile: AuthoringProfile = {
    schemaVersion: AUTHORING_PROFILE_SCHEMA_VERSION,
    archetype: archetypeReference,
    track,
    faceMode,
    face,
    specialists,
    claims,
    routing,
    slots,
    coverage,
    bindings
  };
  const compatibility = evaluateAuthoringCompatibility(profile);
  for (const finding of compatibility.issues) {
    addIssue(issues, finding.path, finding.message, finding.expected);
  }
  return issues.length === 0 ? profile : null;
};

export const normalizeAuthoringProfile = (
  value: unknown,
  context?: AuthoringContext
): NormalizeAuthoringProfileResult => {
  if (
    !isClosedContractRecord(value) ||
    !hasExactContractKeys(value, PROFILE_KEYS)
  ) {
    return failure(
      'authoringProfile',
      'Authoring profile must use the closed contract shape.',
      '{schemaVersion,archetype,track,faceMode,face,specialists,claims,routing,' +
        'slots,coverage,bindings}'
    );
  }
  const issues: AuthoringProfileIssue[] = [];
  if (
    !isCurrentInternalContractVersion(
      'authoringProfile',
      value.schemaVersion
    )
  ) {
    addIssue(
      issues,
      'schemaVersion',
      'Authoring profile version is missing or unsupported.',
      'explicit schemaVersion 1'
    );
  }
  const profile = normalizeProfileRecord(value, context, issues);
  return profile && issues.length === 0
    ? { ok: true, profile }
    : { ok: false, issues };
};

export const createAuthoringProfile = (
  document: AuthoringContext,
  input: AuthoringSelectionInput
): NormalizeAuthoringProfileResult => {
  if (!document.intent) {
    return failure(
      'intent',
      'Authoring selection requires a current project intent.',
      'project.intent.set before project.authoring.configure'
    );
  }
  if (
    !isClosedContractRecord(input) ||
    !hasExactContractKeys(input, SELECTION_KEYS)
  ) {
    return failure(
      'authoringProfile',
      'Authoring selection must use the closed contract shape.',
      '{archetype,track,faceMode,face,specialists,claims,slots,coverage,bindings}'
    );
  }
  const routing = authoringRoutingSnapshot(document);
  if (!routing) {
    return failure(
      'routing',
      'Authoring routing snapshot is unavailable.',
      'a current normalized project intent'
    );
  }
  return normalizeAuthoringProfile({
    schemaVersion: AUTHORING_PROFILE_SCHEMA_VERSION,
    archetype: input.archetype,
    track: input.track,
    faceMode: input.faceMode,
    face: input.face,
    specialists: input.specialists,
    claims: input.claims,
    routing,
    slots: input.slots,
    coverage: input.coverage,
    bindings: input.bindings
  }, document);
};

export const readAuthoringProfile = (
  document: AuthoringContext & { readonly authoringProfile?: unknown }
): ReadAuthoringProfileResult => {
  if (document.authoringProfile === undefined) {
    return { ok: true, profile: null };
  }
  const result = normalizeAuthoringProfile(
    document.authoringProfile,
    document
  );
  if (!result.ok) return result;
  if (
    canonicalJsonString(document.authoringProfile) !==
    canonicalJsonString(result.profile)
  ) {
    return failure(
      'authoringProfile',
      'Stored authoring profile is not in canonical contract form.',
      'replace it through project.authoring.configure'
    );
  }
  return result;
};
