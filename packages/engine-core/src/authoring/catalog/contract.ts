import type {
  ArchetypeId,
  AttachmentPortType,
  AuthoringCapability,
  AuthoringFacet,
  AuthoringMotionRole,
  AuthoringPartKind,
  AuthoringQualityStage,
  AuthoringReviewCheck,
  AuthoringStructuralRole,
  EvidenceCriterionDefinition,
  SpecialistId
} from '../contract';
import { AUTHORING_PROFILE_SCHEMA_VERSION } from '../contract';

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

export interface SpecialistBindingRequirement {
  type: 'motion';
  allowedRoles: readonly AuthoringMotionRole[];
  minBindings: number;
  maxBindings: number;
}

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

export interface AuthoringCatalogIssue {
  code: `authoring.catalog.${string}`;
  path: string;
  message: string;
}

/** Immutable catalog view shared by independent validation stages. */
export interface AuthoringCatalogSnapshot {
  readonly archetypes: readonly ArchetypeDefinition[];
  readonly specialists: readonly SpecialistDefinition[];
}

export type AuthoringCatalogValidationStage = (
  catalog: AuthoringCatalogSnapshot
) => readonly AuthoringCatalogIssue[];
