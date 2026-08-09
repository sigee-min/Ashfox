import type {
  AuthoringPartKind,
  AuthoringQualityStage,
  AuthoringStructuralRole
} from '../contract';
import type {
  SpecialistContributionDefinition,
  StructuralRolePolicyDefinition
} from './contract';

interface ContributionOptions {
  required?: boolean;
  minParts?: number;
  maxParts?: number;
}

export const structuralRolePolicy = (
  role: AuthoringStructuralRole,
  acceptedPartKinds: readonly AuthoringPartKind[],
  allowedQualityStages: readonly AuthoringQualityStage[],
  instruction: string
): StructuralRolePolicyDefinition => ({
  role,
  acceptedPartKinds,
  allowedQualityStages,
  instruction,
});

export const contribution = (
  id: string,
  label: string,
  attachmentRequirementId: string,
  acceptedPartKinds: readonly AuthoringPartKind[],
  instruction: string,
  options: ContributionOptions = {}
): SpecialistContributionDefinition => ({
  id,
  label,
  acceptedPartKinds,
  instruction,
  required: options.required ?? true,
  minParts: options.minParts ?? 1,
  maxParts: options.maxParts ?? 1,
  attachmentRequirementId
});
