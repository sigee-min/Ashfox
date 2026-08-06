import { INTERNAL_CONTRACT_VERSIONS } from '@ashfox/internal-contracts';

export const AUTHORING_PROFILE_SCHEMA_VERSION =
  INTERNAL_CONTRACT_VERSIONS.authoringProfile;
export const AUTHORING_ROUTING_CONTRACT_VERSION =
  INTERNAL_CONTRACT_VERSIONS.authoringRouting;

export const ARCHETYPE_IDS = [
  'archetype.mini-biped',
  'archetype.pillar-stalker',
  'archetype.quadruped',
  'archetype.compact-construct'
] as const;

export const SPECIALIST_IDS = [
  'specialist.role-props',
  'specialist.hard-surface',
  'specialist.decay-cues',
  'specialist.arcane-cues',
  'specialist.organic-cues',
  'specialist.protective-shell',
  'specialist.static-loop',
  'specialist.alternating-gait',
  'specialist.stalking-gait',
  'specialist.rotary-cycle'
] as const;

export type ArchetypeId = (typeof ARCHETYPE_IDS)[number];
export type SpecialistId = (typeof SPECIALIST_IDS)[number];
export type AuthoringAuthorityId = ArchetypeId | SpecialistId;

export interface AuthoringAuthorityReference<
  TId extends AuthoringAuthorityId = AuthoringAuthorityId
> {
  id: TId;
  version: typeof AUTHORING_PROFILE_SCHEMA_VERSION;
}

export type ArchetypeReference = AuthoringAuthorityReference<ArchetypeId>;
export type SpecialistReference = AuthoringAuthorityReference<SpecialistId>;
export type AuthoringClaimBasis = 'observed' | 'requested';

export const AUTHORING_FACETS = [
  'character',
  'humanoid',
  'upright',
  'creature',
  'arm-free',
  'quadruped',
  'horizontal',
  'construct',
  'compact',
  'functional',
  'role-prop',
  'surface-cue',
  'hard-surface',
  'decay',
  'arcane',
  'organic',
  'silhouette-cue',
  'protective',
  'motion',
  'gait',
  'rotary',
  'silhouette',
  'face',
  'grounding',
  'function'
] as const;
export type AuthoringFacet = (typeof AUTHORING_FACETS)[number];

export const AUTHORING_CAPABILITIES = [
  'animation.anchor',
  'locomotion.paired',
  'locomotion.stalking',
  'rotary.drive',
  'surface.host',
  'cue.role',
  'cue.manufactured',
  'cue.decay',
  'cue.arcane',
  'cue.organic',
  'cue.protective',
  'animation.idle',
  'animation.gait',
  'animation.stalk',
  'animation.rotary'
] as const;
export type AuthoringCapability =
  (typeof AUTHORING_CAPABILITIES)[number];

export const ATTACHMENT_PORT_TYPES = [
  'role-prop',
  'surface-cue',
  'silhouette-cue'
] as const;
export type AttachmentPortType =
  (typeof ATTACHMENT_PORT_TYPES)[number];

export interface AuthoringAuthorityClaim {
  authority: AuthoringAuthorityReference;
  criterionId: string;
  basis: AuthoringClaimBasis;
  referenceIds: readonly string[];
  rationale: string;
}

export interface EvidenceCriterionDefinition {
  id: string;
  basis: AuthoringClaimBasis | 'either';
  required: boolean;
  instruction: string;
}

export const AUTHORING_PART_KINDS = [
  'mass',
  'segment',
  'plate',
  'radial',
  'feature'
] as const;
export type AuthoringPartKind = (typeof AUTHORING_PART_KINDS)[number];
export const AUTHORING_SPATIAL_RELATIONS = [
  'left',
  'right',
  'front',
  'rear',
  'above',
  'below'
] as const;
export type AuthoringSpatialRelation =
  (typeof AUTHORING_SPATIAL_RELATIONS)[number];

export const AUTHORING_REVIEW_CAMERAS = [
  'perspective',
  'native',
  'front',
  'side',
  'top'
] as const;
export type AuthoringReviewCamera =
  (typeof AUTHORING_REVIEW_CAMERAS)[number];

export const AUTHORING_REVIEW_ISSUES = [
  'silhouette',
  'proportion',
  'connection',
  'clipping',
  'focal_detail',
  'material',
  'pivot',
  'motion',
  'other'
] as const;
export type AuthoringReviewIssue =
  (typeof AUTHORING_REVIEW_ISSUES)[number];

export interface AuthoringReviewCheck {
  id: string;
  facets: readonly AuthoringFacet[];
  cameras: readonly AuthoringReviewCamera[];
  issue: AuthoringReviewIssue;
  instruction: string;
}

export interface AppliedAuthoringReviewCheck extends AuthoringReviewCheck {
  authority: AuthoringAuthorityReference;
  authorityType: 'archetype' | 'specialist';
}

export interface SemanticSlotDefinition {
  id: string;
  label: string;
  acceptedPartKinds: readonly AuthoringPartKind[];
  instruction: string;
  required: boolean;
  minParts: number;
  maxParts: number;
  parentSlotIds: readonly string[];
  spatialRelations: readonly AuthoringSpatialRelation[];
  facing: 'forward' | null;
}

export interface SpecialistContributionDefinition {
  id: string;
  label: string;
  acceptedPartKinds: readonly AuthoringPartKind[];
  instruction: string;
  required: boolean;
  minParts: number;
  maxParts: number;
  attachmentRequirementId: string;
}

export interface AttachmentPortDefinition {
  id: string;
  type: AttachmentPortType;
  hostSlotIds: readonly string[];
  capacity: number;
  acceptsFacets: readonly AuthoringFacet[];
}

export type CompatibilityScalarPath =
  | 'archetype.id'
  | 'routing.animationSupported';
export type CompatibilityCollectionPath =
  | 'archetype.facets'
  | 'archetype.capabilities'
  | 'selection.specialistIds'
  | 'selection.facets'
  | 'selection.capabilities';

type FacetCollectionPath =
  | 'archetype.facets'
  | 'selection.facets';
type CapabilityCollectionPath =
  | 'archetype.capabilities'
  | 'selection.capabilities';

export type CompatibilityClause =
  | {
      op: 'equals';
      path: 'archetype.id';
      value: ArchetypeId;
    }
  | {
      op: 'equals';
      path: 'routing.animationSupported';
      value: boolean;
    }
  | {
      op: 'includes';
      path: FacetCollectionPath;
      value: AuthoringFacet;
    }
  | {
      op: 'includes';
      path: CapabilityCollectionPath;
      value: AuthoringCapability;
    }
  | {
      op: 'includes';
      path: 'selection.specialistIds';
      value: SpecialistId;
    }
  | {
      op: 'forbids';
      path: FacetCollectionPath;
      value: AuthoringFacet;
    }
  | {
      op: 'forbids';
      path: CapabilityCollectionPath;
      value: AuthoringCapability;
    }
  | {
      op: 'forbids';
      path: 'selection.specialistIds';
      value: SpecialistId;
    }
  | {
      op: 'requires-port';
      requirementId: string;
      portType: AttachmentPortType;
    }
  | {
      op: 'provides-capability';
      capability: AuthoringCapability;
    };

export type AttachmentRequirement = Extract<
  CompatibilityClause,
  { op: 'requires-port' }
>;

export interface ArchetypeDefinition {
  id: ArchetypeId;
  version: typeof AUTHORING_PROFILE_SCHEMA_VERSION;
  label: string;
  summary: string;
  useWhen: string;
  instruction: string;
  facets: readonly AuthoringFacet[];
  capabilities: readonly AuthoringCapability[];
  evidenceCriteria: readonly EvidenceCriterionDefinition[];
  semanticSlots: readonly SemanticSlotDefinition[];
  attachmentPorts: readonly AttachmentPortDefinition[];
  compatibility: readonly CompatibilityClause[];
  reviewChecks: readonly AuthoringReviewCheck[];
}

export interface SpecialistDefinition {
  id: SpecialistId;
  version: typeof AUTHORING_PROFILE_SCHEMA_VERSION;
  label: string;
  summary: string;
  useWhen: string;
  instruction: string;
  facets: readonly AuthoringFacet[];
  capabilities: readonly AuthoringCapability[];
  evidenceCriteria: readonly EvidenceCriterionDefinition[];
  attachmentRequirements: readonly AttachmentRequirement[];
  contributions: readonly SpecialistContributionDefinition[];
  bindingRequirements: readonly SpecialistBindingRequirement[];
  compatibility: readonly CompatibilityClause[];
  reviewChecks: readonly AuthoringReviewCheck[];
}

export interface AuthoringRoutingSnapshot {
  contractVersion: typeof AUTHORING_ROUTING_CONTRACT_VERSION;
  animationSupported: boolean;
  canonicalInput: string;
  referenceIds: readonly string[];
}

export interface AuthoringSlotAssignment {
  slotId: string;
  partIds: readonly string[];
  reason?: string;
}

export interface AuthoringAttachmentBinding {
  type: 'attachment';
  contributionId: string;
  portId: string;
  hostSlotId: string;
  partIds: readonly string[];
}

export type AuthoringMotionRole = 'idle' | 'loop' | 'once';

export interface SpecialistBindingRequirement {
  type: 'motion';
  allowedRoles: readonly AuthoringMotionRole[];
  minBindings: number;
  maxBindings: number;
}

export interface AuthoringMotionBinding {
  type: 'motion';
  specialist: SpecialistReference;
  clipId: string;
  role: AuthoringMotionRole;
}

export type AuthoringBinding =
  | AuthoringAttachmentBinding
  | AuthoringMotionBinding;

export interface AuthoringSelectionInput {
  archetype: ArchetypeReference;
  specialists: readonly SpecialistReference[];
  claims: readonly AuthoringAuthorityClaim[];
  slots: readonly AuthoringSlotAssignment[];
  bindings: readonly AuthoringBinding[];
}

export interface AuthoringProfile extends AuthoringSelectionInput {
  schemaVersion: typeof AUTHORING_PROFILE_SCHEMA_VERSION;
  routing: AuthoringRoutingSnapshot;
}

export interface ComposedAuthoringSlotDefinition
  extends SemanticSlotDefinition {
  authority: AuthoringAuthorityReference;
  authorityType: 'archetype' | 'specialist';
  attachmentPortId: string | null;
  hostSlotId: string | null;
}

export interface AuthoringCompatibilityIssue {
  code: `authoring.compatibility.${string}`;
  path: string;
  message: string;
  expected: string;
  authority?: AuthoringAuthorityReference;
}

export interface AuthoringCompatibilityResult {
  compatible: boolean;
  issues: readonly AuthoringCompatibilityIssue[];
}

export interface AuthoringRecipeSummary {
  id: string;
  label: string;
  summary: string;
  role: 'non-authoritative';
  archetype: ArchetypeReference;
  specialists: readonly SpecialistReference[];
}

export interface AuthoringRecipe extends AuthoringRecipeSummary {
  claimSuggestions: readonly AuthoringAuthorityClaim[];
  slotSuggestions: readonly AuthoringSlotAssignment[];
  bindingSuggestions: readonly AuthoringBinding[];
}
