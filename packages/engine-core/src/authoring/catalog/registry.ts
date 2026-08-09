import {
  hasExactContractKeys,
  isClosedContractRecord,
  isCurrentInternalContractVersion
} from '@ashfox/internal-contracts';

import { archetypeDefinitions } from './archetype/definitions';
import { validateAuthoringCatalog } from './index';
import { deepFreezeAuthoringValue } from '../values';
import { specialistDefinitions } from './specialist/definitions';
import { authoringTrackPolicy } from '../profile/tracks';
import {
  ARCHETYPE_IDS,
  SPECIALIST_IDS,
  type AppliedAuthoringReviewCheck,
  type ArchetypeId,
  type ArchetypeReference,
  type AuthoringAuthorityId,
  type AuthoringAuthorityReference,
  type AuthoringProfile,
  type AuthoringReviewCamera,
  type AuthoringReviewCheck,
  type SpecialistId,
  type SpecialistReference
} from '../contract';
import type {
  ArchetypeDefinition,
  SpecialistDefinition
} from './contract';

const catalogIssues = validateAuthoringCatalog(
  archetypeDefinitions,
  specialistDefinitions
);
if (catalogIssues.length > 0) {
  throw new Error(
    `Invalid authoring catalog: ${catalogIssues.map((entry) =>
      `${entry.path}: ${entry.message}`
    ).join('; ')}`
  );
}

const archetypes = deepFreezeAuthoringValue([...archetypeDefinitions]);
const specialists = deepFreezeAuthoringValue([...specialistDefinitions]);
const archetypesById = new Map<ArchetypeId, ArchetypeDefinition>(
  archetypes.map((definition) => [definition.id, definition])
);
const specialistsById = new Map<SpecialistId, SpecialistDefinition>(
  specialists.map((definition) => [definition.id, definition])
);

interface VersionedAuthorityReference {
  readonly id: string;
  readonly version: AuthoringAuthorityReference['version'];
}

const isStrictReference = (
  value: unknown
): value is VersionedAuthorityReference =>
  isClosedContractRecord(value) &&
  hasExactContractKeys(value, new Set(['id', 'version'])) &&
  typeof value.id === 'string' &&
  isCurrentInternalContractVersion('authoringProfile', value.version);

const isArchetypeId = (value: string): value is ArchetypeId =>
  ARCHETYPE_IDS.some((id) => id === value);

const isSpecialistId = (value: string): value is SpecialistId =>
  SPECIALIST_IDS.some((id) => id === value);

export const isArchetypeReference = (
  value: unknown
): value is ArchetypeReference =>
  isStrictReference(value) && isArchetypeId(value.id);

export const isSpecialistReference = (
  value: unknown
): value is SpecialistReference =>
  isStrictReference(value) && isSpecialistId(value.id);

export const listArchetypes = (): readonly ArchetypeDefinition[] =>
  archetypes;

export const getArchetype = (
  id: string
): ArchetypeDefinition | undefined =>
  isArchetypeId(id) ? archetypesById.get(id) : undefined;

export const resolveArchetypeReference = (
  reference: unknown
): ArchetypeDefinition | undefined => {
  if (!isArchetypeReference(reference)) return undefined;
  return archetypesById.get(reference.id);
};

export const listSpecialists = (): readonly SpecialistDefinition[] =>
  specialists;

export const getSpecialist = (
  id: string
): SpecialistDefinition | undefined =>
  isSpecialistId(id) ? specialistsById.get(id) : undefined;

export const resolveSpecialistReference = (
  reference: unknown
): SpecialistDefinition | undefined => {
  if (!isSpecialistReference(reference)) return undefined;
  return specialistsById.get(reference.id);
};

export const authoringAuthorityLabel = (
  reference: AuthoringAuthorityReference
): string =>
  resolveArchetypeReference(reference)?.label ??
  resolveSpecialistReference(reference)?.label ??
  reference.id;

const appliedChecks = (
  authority: ArchetypeDefinition | SpecialistDefinition,
  authorityType: 'archetype' | 'specialist',
  camera: AuthoringReviewCamera,
  facet: string | undefined
): readonly AppliedAuthoringReviewCheck[] =>
  authority.reviewChecks
    .filter((check) => check.cameras.includes(camera))
    .filter((check) =>
      facet === undefined || check.facets.some((value) => value === facet)
    )
    .map((check) => ({
      ...check,
      authority: {
        id: authority.id as AuthoringAuthorityId,
        version: authority.version
      },
      authorityType
    }));

const profileFaceChecks = (
  profile: AuthoringProfile
): readonly AuthoringReviewCheck[] => {
  if (profile.faceMode !== 'full') return [];
  const trackCheck = authoringTrackPolicy(profile.track).face.reviewCheck;
  return [
    {
      id: 'composable-form.face-native-read',
      facets: ['face'],
      cameras: ['native'],
      issue: 'focal_detail',
      instruction:
        'At native gameplay size, confirm gaze direction, mouth state, and expression read immediately; reject a one-pixel eye, occluded pupil, or ambiguous mouth.'
    },
    trackCheck,
    {
      id: 'composable-form.face-surface-contrast',
      facets: ['face', 'surface-cue'],
      cameras: ['native', 'perspective', 'front'],
      issue: 'material',
      instruction:
        'Confirm generated facial noise stays subordinate to the flat focal glyphs and that eye, nasal, lip or interior role colors remain distinct from their host planes.'
    }
  ];
};

const profileTrackChecks = (
  profile: AuthoringProfile
): readonly AuthoringReviewCheck[] =>
  authoringTrackPolicy(profile.track).reviewChecks;

const appliedProfileChecks = (
  profile: AuthoringProfile,
  camera: AuthoringReviewCamera,
  facet: string | undefined
): readonly AppliedAuthoringReviewCheck[] =>
  [...profileTrackChecks(profile), ...profileFaceChecks(profile)]
    .filter((check) => check.cameras.includes(camera))
    .filter((check) =>
      facet === undefined || check.facets.some((value) => value === facet)
    )
    .map((check) => ({
      ...check,
      authority: profile.archetype,
      authorityType: 'archetype' as const
    }));

export const authoringReviewChecks = (
  profile: AuthoringProfile | undefined,
  camera: AuthoringReviewCamera,
  options: { facet?: string; clipId?: string | null } = {}
): readonly AppliedAuthoringReviewCheck[] => {
  if (!profile) return [];
  const archetype = resolveArchetypeReference(profile.archetype);
  if (!archetype) return [];
  const selectedSpecialists = profile.specialists.flatMap((reference) => {
    const definition = resolveSpecialistReference(reference);
    return definition ? [definition] : [];
  });
  const facet = options.facet ??
    (options.clipId === undefined ? undefined : 'motion');
  const clipBinding = typeof options.clipId === 'string'
    ? profile.bindings.find((binding) =>
        binding.type === 'motion' && binding.clipId === options.clipId
      )
    : undefined;
  const clipSpecialistId = clipBinding?.type === 'motion'
    ? clipBinding.specialist.id
    : undefined;
  const applicableSpecialists = typeof options.clipId === 'string'
    ? selectedSpecialists.filter((definition) =>
        definition.id === clipSpecialistId
      )
    : selectedSpecialists;
  return [
    ...appliedChecks(archetype, 'archetype', camera, facet),
    ...appliedProfileChecks(profile, camera, facet),
    ...applicableSpecialists.flatMap((definition) =>
      appliedChecks(definition, 'specialist', camera, facet)
    )
  ];
};
