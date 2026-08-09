/** Shared leaf constants for the one current ProjectIntent contract. */
export const PROJECT_INTENT_STABLE_ID_PATTERN_SOURCE =
  '^[a-z][a-z0-9._-]{0,63}$';

export const PROJECT_REFERENCE_ID_PATTERN_SOURCE =
  PROJECT_INTENT_STABLE_ID_PATTERN_SOURCE;

export const PROJECT_SUPPORTED_SURFACE_LIMIT = 16;

export const PROJECT_INTENT_LIMITS = Object.freeze({
  maxSubjectLength: 160,
  maxFeatureLength: 240,
  maxFeatures: 32,
  maxReferences: 16,
  maxSupportedSurfaces: PROJECT_SUPPORTED_SURFACE_LIMIT,
  maxReferenceDescriptionLength: 480,
  maxReferenceCues: 16,
  maxReferenceCueLength: 240
});

export const PROJECT_FORWARD_DIRECTIONS = [
  'north', 'south', 'east', 'west'
] as const;

export const PROJECT_GROUNDING_VALUES = [
  'grounded', 'none', 'free-explicit'
] as const;

export const PROJECT_REFERENCE_KINDS = [
  'image', 'text', 'model'
] as const;

export const PROJECT_INTENT_KEYS = [
  'subject',
  'forward',
  'grounding',
  'symmetry',
  'semanticContract',
  'features',
  'references',
  'appearance',
  'appearanceBindings'
] as const;

export const PROJECT_REFERENCE_KEYS = [
  'id', 'kind', 'description', 'cues', 'contentHash'
] as const;
