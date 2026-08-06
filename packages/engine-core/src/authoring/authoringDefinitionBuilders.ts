import type {
  AuthoringPartKind,
  AuthoringSpatialRelation,
  SemanticSlotDefinition,
  SpecialistContributionDefinition
} from './authoringTypes';

interface SlotOptions {
  required?: boolean;
  minParts?: number;
  maxParts?: number;
  parentSlotIds?: readonly string[];
  spatialRelations?: readonly AuthoringSpatialRelation[];
  facing?: 'forward' | null;
}

export const semanticSlot = (
  id: string,
  label: string,
  acceptedPartKinds: readonly AuthoringPartKind[],
  instruction: string,
  options: SlotOptions = {}
): SemanticSlotDefinition => ({
  id,
  label,
  acceptedPartKinds,
  instruction,
  required: options.required ?? true,
  minParts: options.minParts ?? 1,
  maxParts: options.maxParts ?? 1,
  parentSlotIds: options.parentSlotIds ?? [],
  spatialRelations: options.spatialRelations ?? [],
  facing: options.facing ?? null
});

export const contribution = (
  id: string,
  label: string,
  attachmentRequirementId: string,
  acceptedPartKinds: readonly AuthoringPartKind[],
  instruction: string,
  options: Pick<SlotOptions, 'required' | 'minParts' | 'maxParts'> = {}
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
