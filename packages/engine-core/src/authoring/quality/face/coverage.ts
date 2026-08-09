import type {
  EyeFeaturePartSpec,
  PartSpec
} from '../../../modeling/part';
import type { AuthoringSlotStatus } from '../../plan/contract';
import {
  authoringFaceComponentSlotIds,
  type AuthoringFaceComponentDeclaration,
  type AuthoringFaceContract
} from '../../contract';
import { uniqueSortedAuthoringValues } from '../../values';
import { realizesFaceForm } from './geometry';

const partDescendsFrom = (
  part: PartSpec,
  ancestorPartIds: ReadonlySet<string>,
  partsById: ReadonlyMap<string, PartSpec>
): boolean => {
  let parentId = part.parentPartId;
  const visited = new Set<string>();
  while (parentId !== null && !visited.has(parentId)) {
    if (ancestorPartIds.has(parentId)) return true;
    visited.add(parentId);
    parentId = partsById.get(parentId)?.parentPartId ?? null;
  }
  return false;
};

export interface FaceComponentCoverage {
  readonly declaration: AuthoringFaceComponentDeclaration;
  readonly slotIds: readonly string[];
  readonly completeSlotIds: readonly string[];
  readonly missingSlotIds: readonly string[];
  readonly partIds: readonly string[];
  readonly materializedPartCount: number;
  readonly semanticPartIds: readonly string[];
  readonly semanticPartCount: number;
  readonly readableEyes: readonly EyeFeaturePartSpec[];
  readonly realizedMaterialIds: readonly string[];
  readonly missingMaterialIds: readonly string[];
}

interface FaceCoverageInput {
  readonly face: AuthoringFaceContract;
  readonly slotsById: ReadonlyMap<string, AuthoringSlotStatus>;
  readonly partsById: ReadonlyMap<string, PartSpec>;
  readonly explicitMaterialIds: ReadonlySet<string>;
  readonly hostPartIds: ReadonlySet<string>;
}

const evaluateComponentCoverage = (
  declaration: AuthoringFaceComponentDeclaration,
  input: FaceCoverageInput
): FaceComponentCoverage => {
  const slotIds = authoringFaceComponentSlotIds(declaration);
  const mappedSlots = slotIds.flatMap((slotId) => {
    const slot = input.slotsById.get(slotId);
    return slot ? [slot] : [];
  });
  const completeSlotIds = mappedSlots
    .filter((slot) => slot.state === 'complete')
    .map((slot) => slot.slotId);
  const missingSlotIds = slotIds.filter(
    (slotId) => !completeSlotIds.includes(slotId)
  );
  const partIds = uniqueSortedAuthoringValues(
    mappedSlots.flatMap((slot) => slot.partIds)
  );
  const materializedPartIds = partIds.filter((partId) =>
    input.partsById.has(partId)
  );
  const realizedParts = partIds.flatMap((partId) => {
    const part = input.partsById.get(partId);
    return part && partDescendsFrom(
      part,
      input.hostPartIds,
      input.partsById
    ) ? [part] : [];
  });
  const semanticParts = realizedParts.filter((part) =>
    realizesFaceForm(part, declaration.form)
  );
  const readableEyes = declaration.component === 'eye'
    ? semanticParts.filter((part): part is EyeFeaturePartSpec =>
        part.kind === 'feature' &&
        part.motif === 'eye' &&
        part.size[0] >= 3 &&
        part.size[1] >= 3
      )
    : [];
  const materialEligibleParts = declaration.component === 'eye'
    ? readableEyes
    : semanticParts;
  const realizedMaterialIds = declaration.materialIds.filter((materialId) =>
    input.explicitMaterialIds.has(materialId) &&
    materialEligibleParts.some((part) => part.materialId === materialId)
  );
  const missingMaterialIds = declaration.materialIds.filter(
    (materialId) => !realizedMaterialIds.includes(materialId)
  );
  return {
    declaration,
    slotIds,
    completeSlotIds,
    missingSlotIds,
    partIds,
    materializedPartCount: materializedPartIds.length,
    semanticPartIds: semanticParts.map((part) => part.partId),
    semanticPartCount: semanticParts.length,
    readableEyes,
    realizedMaterialIds,
    missingMaterialIds
  };
};

export const evaluateFaceComponentCoverage = (
  input: FaceCoverageInput
): readonly FaceComponentCoverage[] => input.face.components.map(
  (declaration) => evaluateComponentCoverage(declaration, input)
);
