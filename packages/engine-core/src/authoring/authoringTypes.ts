import { INTERNAL_CONTRACT_VERSIONS } from '@ashfox/internal-contracts';

export const AUTHORING_PROFILE_SCHEMA_VERSION =
  INTERNAL_CONTRACT_VERSIONS.authoringProfile;
export const AUTHORING_ROUTING_CONTRACT_VERSION =
  INTERNAL_CONTRACT_VERSIONS.authoringRouting;

export const ARCHETYPE_IDS = [
  'archetype.composable-form'
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
  'composable',
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
  'function'
] as const;
export type AuthoringFacet = (typeof AUTHORING_FACETS)[number];

export const AUTHORING_CAPABILITIES = [
  'animation.anchor',
  'locomotion.paired',
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

export const AUTHORING_STRUCTURAL_ROLES = [
  'core',
  'axis',
  'articulated',
  'span',
  'focal-frame',
  'accent'
] as const;
export type AuthoringStructuralRole =
  (typeof AUTHORING_STRUCTURAL_ROLES)[number];

// The declaration order is the quality-gate order.
export const AUTHORING_QUALITY_STAGES = [
  'silhouette',
  'structure',
  'focal'
] as const;
export type AuthoringQualityStage =
  (typeof AUTHORING_QUALITY_STAGES)[number];

export const AUTHORING_CONTACTS = ['grounded', 'free'] as const;
export type AuthoringContact = (typeof AUTHORING_CONTACTS)[number];

export const AUTHORING_SLOT_SYMMETRY_KINDS = [
  'centered',
  'paired',
  'asymmetric'
] as const;
export type AuthoringSlotSymmetryKind =
  (typeof AUTHORING_SLOT_SYMMETRY_KINDS)[number];

/**
 * A slot is never "implicitly symmetric". Bilateral ownership is a closed,
 * persisted contract so final compiled occupancy can be checked exactly.
 */
export type AuthoringSlotSymmetry =
  | { kind: 'centered' }
  | { kind: 'paired'; pairId: string }
  | { kind: 'asymmetric' };

export interface AuthoringFootDigit {
  digitId: string;
  toePartIds: readonly string[];
  clawPartIds: readonly string[];
}

/**
 * Support semantics stay above geometry primitives. This preserves a small
 * geometric grammar while making base/sole/toe/claw intent machine-checkable.
 */
export type AuthoringSupport =
  | { kind: 'none' }
  | {
      kind: 'base';
      contact: AuthoringContact;
      supportPartIds: readonly string[];
    }
  | {
      kind: 'foot';
      contact: AuthoringContact;
      rootPartId: string;
      solePartIds: readonly string[];
      digits: readonly AuthoringFootDigit[];
    };

export const AUTHORING_TRACKS = ['essential', 'hero'] as const;
export type AuthoringTrack = (typeof AUTHORING_TRACKS)[number];

export const AUTHORING_FACE_MODES = ['none', 'full'] as const;
export type AuthoringFaceMode = (typeof AUTHORING_FACE_MODES)[number];

export const AUTHORING_FACE_COMPONENTS = [
  'eye',
  'nasal',
  'oral',
  'eye-frame',
  'jaw',
  'mouth-interior'
] as const;
export type AuthoringFaceComponent =
  (typeof AUTHORING_FACE_COMPONENTS)[number];

export const AUTHORING_FACE_FORMS = [
  'eye',
  'nose',
  'muzzle',
  'beak',
  'mouth',
  'jaw',
  'orbital',
  'brow',
  'mouth-interior'
] as const;
export type AuthoringFaceForm = (typeof AUTHORING_FACE_FORMS)[number];

export const AUTHORING_EYE_CONFIGURATIONS = ['single', 'paired'] as const;
export type AuthoringEyeConfigurationKind =
  (typeof AUTHORING_EYE_CONFIGURATIONS)[number];

export const AUTHORING_EYE_PALETTES = ['high-contrast'] as const;
export type AuthoringEyePalette =
  (typeof AUTHORING_EYE_PALETTES)[number];

export type AuthoringEyeConfiguration =
  | { kind: 'single'; slotId: string }
  | {
      kind: 'paired';
      leftSlotId: string;
      rightSlotId: string;
    };

export const AUTHORING_MOUTH_STATES = [
  'closed',
  'open',
  'beak',
  'absent'
] as const;
export type AuthoringMouthState =
  (typeof AUTHORING_MOUTH_STATES)[number];

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

export interface StructuralRolePolicyDefinition {
  role: AuthoringStructuralRole;
  acceptedPartKinds: readonly AuthoringPartKind[];
  allowedQualityStages: readonly AuthoringQualityStage[];
  instruction: string;
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
  hostStructuralRoles: readonly AuthoringStructuralRole[];
  capacity: number;
  acceptsFacets: readonly AuthoringFacet[];
}

export type CompatibilityScalarPath = 'routing.animationSupported';
export type CompatibilityCollectionPath = 'selection.specialistIds';

export type CompatibilityClause =
  | {
      op: 'equals';
      path: 'routing.animationSupported';
      value: boolean;
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
  structuralRolePolicies: readonly StructuralRolePolicyDefinition[];
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
  structuralRole: AuthoringStructuralRole;
  qualityStage: AuthoringQualityStage;
  partIds: readonly string[];
  parentSlotIds: readonly string[];
  spatialRelations: readonly AuthoringSpatialRelation[];
  facing: 'forward' | null;
  symmetry: AuthoringSlotSymmetry;
  support: AuthoringSupport;
}

export interface AuthoringFeatureCoverage {
  featureRef: string;
  slotIds: readonly string[];
  materialIds: readonly string[];
}

interface AuthoringFaceComponentDeclarationBase {
  materialIds: readonly string[];
}

export interface AuthoringEyeFaceComponentDeclaration
  extends AuthoringFaceComponentDeclarationBase {
  component: 'eye';
  form: 'eye';
  configuration: AuthoringEyeConfiguration;
  gaze: 'centered';
  palette: AuthoringEyePalette;
}

export interface AuthoringNonEyeFaceComponentDeclaration
  extends AuthoringFaceComponentDeclarationBase {
  component: Exclude<AuthoringFaceComponent, 'eye'>;
  form: Exclude<AuthoringFaceForm, 'eye'>;
  slotIds: readonly string[];
}

export type AuthoringFaceComponentDeclaration =
  | AuthoringEyeFaceComponentDeclaration
  | AuthoringNonEyeFaceComponentDeclaration;

export const authoringFaceComponentSlotIds = (
  declaration: AuthoringFaceComponentDeclaration
): readonly string[] => {
  if (declaration.component !== 'eye') return declaration.slotIds;
  return declaration.configuration.kind === 'single'
    ? [declaration.configuration.slotId]
    : [
        declaration.configuration.leftSlotId,
        declaration.configuration.rightSlotId
      ];
};

export interface AuthoringFaceException {
  component: 'nasal' | 'oral';
  basis: AuthoringClaimBasis;
  referenceIds: readonly string[];
  rationale: string;
}

export interface AuthoringFaceContract {
  hostSlotId: string;
  mouthState: AuthoringMouthState;
  components: readonly AuthoringFaceComponentDeclaration[];
  exceptions: readonly AuthoringFaceException[];
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
  track: AuthoringTrack;
  faceMode: AuthoringFaceMode;
  face: AuthoringFaceContract | null;
  specialists: readonly SpecialistReference[];
  claims: readonly AuthoringAuthorityClaim[];
  slots: readonly AuthoringSlotAssignment[];
  coverage: readonly AuthoringFeatureCoverage[];
  bindings: readonly AuthoringBinding[];
}

export interface AuthoringProfile extends AuthoringSelectionInput {
  schemaVersion: typeof AUTHORING_PROFILE_SCHEMA_VERSION;
  routing: AuthoringRoutingSnapshot;
}

export interface ComposedAuthoringSlotDefinition {
  id: string;
  label: string;
  structuralRole: AuthoringStructuralRole | null;
  qualityStage: AuthoringQualityStage;
  acceptedPartKinds: readonly AuthoringPartKind[];
  instruction: string;
  required: boolean;
  minParts: number;
  maxParts: number;
  parentSlotIds: readonly string[];
  spatialRelations: readonly AuthoringSpatialRelation[];
  facing: 'forward' | null;
  symmetry: AuthoringSlotSymmetry | null;
  support: AuthoringSupport | null;
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
  track: AuthoringTrack;
  faceMode: AuthoringFaceMode;
  face: AuthoringFaceContract | null;
  claimSuggestions: readonly AuthoringAuthorityClaim[];
  slotSuggestions: readonly AuthoringSlotAssignment[];
  coverageSuggestions: readonly AuthoringFeatureCoverage[];
  bindingSuggestions: readonly AuthoringBinding[];
}
