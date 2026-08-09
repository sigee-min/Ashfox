import type {
  AuthoringProfile,
  AuthoringSlotAssignment,
  AuthoringSupport
} from './authoringTypes';
import {
  addSupportQualityIssue,
  cellsForParts,
  exactProjectReflection,
  supportQualityIssue
} from './supportQualityGeometry';
import type {
  MutableSupportEvaluation,
  SupportEvaluationContext,
  SupportQualityIssueCode
} from './supportQualityTypes';

interface SupportPairRegion {
  label: string;
  leftPartIds: readonly string[];
  rightPartIds: readonly string[];
}

const footPairRegions = (
  left: Extract<AuthoringSupport, { kind: 'foot' }>,
  right: Extract<AuthoringSupport, { kind: 'foot' }>
): readonly SupportPairRegion[] => {
  const rightDigits = new Map(
    right.digits.map((digit) => [digit.digitId, digit])
  );
  return [
    {
      label: 'root',
      leftPartIds: [left.rootPartId],
      rightPartIds: [right.rootPartId]
    },
    {
      label: 'sole',
      leftPartIds: left.solePartIds,
      rightPartIds: right.solePartIds
    },
    ...left.digits.flatMap((leftDigit): SupportPairRegion[] => {
      const rightDigit = rightDigits.get(leftDigit.digitId);
      if (!rightDigit) return [];
      return [
        {
          label: `digit:${leftDigit.digitId}:toe`,
          leftPartIds: leftDigit.toePartIds,
          rightPartIds: rightDigit.toePartIds
        },
        {
          label: `digit:${leftDigit.digitId}:claw`,
          leftPartIds: leftDigit.clawPartIds,
          rightPartIds: rightDigit.clawPartIds
        }
      ];
    })
  ];
};

const supportPairRegions = (
  left: AuthoringSupport,
  right: AuthoringSupport
): readonly SupportPairRegion[] => {
  if (left.kind === 'base' && right.kind === 'base') {
    return [{
      label: 'base',
      leftPartIds: left.supportPartIds,
      rightPartIds: right.supportPartIds
    }];
  }
  if (left.kind === 'wheel' && right.kind === 'wheel') {
    return [{
      label: 'wheel',
      leftPartIds: left.wheelPartIds,
      rightPartIds: right.wheelPartIds
    }];
  }
  return left.kind === 'foot' && right.kind === 'foot'
    ? footPairRegions(left, right)
    : [];
};

export const validateSupportPairReflections = (
  profile: AuthoringProfile,
  context: SupportEvaluationContext,
  evaluation: MutableSupportEvaluation
): ReadonlyMap<string, readonly SupportQualityIssueCode[]> => {
  const codesBySlotId = new Map<string, SupportQualityIssueCode[]>();
  if (context.frame.planeTwice === null) return codesBySlotId;
  const pairs = new Map<string, AuthoringSlotAssignment[]>();
  for (const slot of profile.slots) {
    if (slot.symmetry.kind !== 'paired') continue;
    pairs.set(slot.symmetry.pairId, [
      ...(pairs.get(slot.symmetry.pairId) ?? []),
      slot
    ]);
  }
  for (const [pairId, slots] of pairs) {
    const left = slots.find((slot) =>
      slot.spatialRelations.includes('left')
    );
    const right = slots.find((slot) =>
      slot.spatialRelations.includes('right')
    );
    if (!left || !right || left.support.kind === 'none' ||
      right.support.kind === 'none') {
      continue;
    }
    const mismatched = supportPairRegions(left.support, right.support)
      .filter((region) => {
        const allPartIds = [
          ...region.leftPartIds,
          ...region.rightPartIds
        ];
        if (
          allPartIds.length === 0 ||
          !allPartIds.every((partId) => context.parts.has(partId))
        ) {
          return false;
        }
        return !exactProjectReflection(
          cellsForParts(region.leftPartIds, context.parts),
          cellsForParts(region.rightPartIds, context.parts),
          context.frame
        );
      });
    if (mismatched.length === 0) continue;
    const entry = supportQualityIssue(
      'authoring.plan.support_pair_reflection_invalid',
      `authoringProfile.slots.${pairId}.support`,
      `Support pair "${pairId}" has non-reflected semantic regions: ` +
        `${mismatched.map((region) => region.label).join(', ')}.`,
      'root, sole/base, and each digit toe/claw occupancy exactly reflected by semantic region',
      mismatched.flatMap((region) => [
        ...region.leftPartIds,
        ...region.rightPartIds
      ])
    );
    addSupportQualityIssue(evaluation, entry, true);
    for (const slot of [left, right]) {
      codesBySlotId.set(slot.slotId, [
        ...(codesBySlotId.get(slot.slotId) ?? []),
        entry.code
      ]);
    }
  }
  return codesBySlotId;
};
