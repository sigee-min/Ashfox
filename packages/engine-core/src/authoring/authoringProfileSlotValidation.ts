import { canonicalJsonString } from '../canonicalJson';
import type { ProjectIntent } from '../model';
import { slotGraphHasCycle } from './authoringCatalogRules';
import {
  addAuthoringProfileIssue as addIssue,
  type AuthoringProfileIssue
} from './authoringEvidence';
import {
  AUTHORING_QUALITY_STAGES,
  type AuthoringSlotAssignment,
  type AuthoringSupport
} from './authoringTypes';
import type { AuthoringSpan } from './authoringSpanTypes';

const validateParentReferences = (
  slots: readonly AuthoringSlotAssignment[],
  issues: AuthoringProfileIssue[]
): void => {
  const slotIds = slots.map((slot) => slot.slotId);
  if (new Set(slotIds).size !== slotIds.length) {
    addIssue(
      issues,
      'slots',
      'Each structural slot ID may be declared once.',
      'unique slot IDs'
    );
  }
  const slotIdSet = new Set(slotIds);
  slots.forEach((slot, index) => {
    for (const parentSlotId of slot.parentSlotIds) {
      if (parentSlotId === slot.slotId || !slotIdSet.has(parentSlotId)) {
        addIssue(
          issues,
          `slots[${index}].parentSlotIds`,
          `Parent slot "${parentSlotId}" is missing or self-referential.`,
          'IDs of other slots declared by this profile'
        );
      }
    }
  });
  if (slotGraphHasCycle(slots)) {
    addIssue(
      issues,
      'slots',
      'Structural slot parent relationships must form a DAG.',
      'an acyclic module graph'
    );
  }
};

const validateRootedStages = (
  slots: readonly AuthoringSlotAssignment[],
  issues: AuthoringProfileIssue[]
): void => {
  const roots = slots.filter((slot) => slot.parentSlotIds.length === 0);
  const root = roots.length === 1 ? roots[0] : undefined;
  if (
    !root ||
    root.structuralRole !== 'core' ||
    root.qualityStage !== 'silhouette'
  ) {
    addIssue(
      issues,
      'slots',
      'A composable form must have exactly one root slot, declared as a silhouette-stage core.',
      'one root with structuralRole core and qualityStage silhouette'
    );
    return;
  }
  const slotsById = new Map(slots.map((slot) => [slot.slotId, slot]));
  const stageIndex = new Map(
    AUTHORING_QUALITY_STAGES.map((stage, index) => [stage, index])
  );
  const reachesRoot = (slot: AuthoringSlotAssignment): boolean => {
    const pending = [...slot.parentSlotIds];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const parentId = pending.pop();
      if (!parentId || visited.has(parentId)) continue;
      if (parentId === root.slotId) return true;
      visited.add(parentId);
      pending.push(...(slotsById.get(parentId)?.parentSlotIds ?? []));
    }
    return slot.slotId === root.slotId;
  };
  for (const slot of slots) {
    if (!reachesRoot(slot)) {
      addIssue(
        issues,
        `slots.${slot.slotId}.parentSlotIds`,
        `Structural slot "${slot.slotId}" does not reach the declared core root.`,
        `an ancestor path to ${root.slotId}`
      );
    }
    for (const parentSlotId of slot.parentSlotIds) {
      const parent = slotsById.get(parentSlotId);
      if (
        parent &&
        (stageIndex.get(parent.qualityStage) ?? 0) >
          (stageIndex.get(slot.qualityStage) ?? 0)
      ) {
        addIssue(
          issues,
          `slots.${slot.slotId}.qualityStage`,
          `Structural slot "${slot.slotId}" places ${slot.qualityStage} below later-stage parent "${parentSlotId}" (${parent.qualityStage}).`,
          'parent qualityStage must be the same as or earlier than its child'
        );
      }
    }
    if (slot.qualityStage !== 'focal') continue;
    const pending = [...slot.parentSlotIds];
    const visited = new Set<string>();
    let reachesEarlierStage = false;
    while (pending.length > 0 && !reachesEarlierStage) {
      const parentId = pending.pop();
      if (!parentId || visited.has(parentId)) continue;
      visited.add(parentId);
      const parent = slotsById.get(parentId);
      if (!parent) continue;
      reachesEarlierStage = parent.qualityStage !== 'focal';
      pending.push(...parent.parentSlotIds);
    }
    if (!reachesEarlierStage) {
      addIssue(
        issues,
        `slots.${slot.slotId}.parentSlotIds`,
        `Focal slot "${slot.slotId}" has no earlier-stage ancestor.`,
        'an ancestor declared at silhouette or structure stage'
      );
    }
  }
};

const supportSignature = (support: AuthoringSupport): string => {
  if (support.kind === 'none') return 'none';
  if (support.kind === 'base') {
    return canonicalJsonString({
      kind: support.kind,
      contact: support.contact,
      supportPartCount: support.supportPartIds.length
    });
  }
  return canonicalJsonString({
    kind: support.kind,
    contact: support.contact,
    solePartCount: support.solePartIds.length,
    digits: [...support.digits]
      .sort((left, right) => left.digitId.localeCompare(right.digitId))
      .map((digit) => ({
        digitId: digit.digitId,
        toePartCount: digit.toePartIds.length,
        clawPartCount: digit.clawPartIds.length
      }))
  });
};

const spanSignature = (span: AuthoringSpan): string =>
  span.kind === 'none'
    ? 'none'
    : canonicalJsonString({
        kind: span.kind,
        obligationId: span.obligationId,
        rootPartCount: span.rootPartIds.length,
        spars: span.spars.map((spar) => ({
          sparId: spar.sparId,
          partCount: spar.partIds.length
        })),
        membranes: span.membranes.map((membrane) => ({
          membraneId: membrane.membraneId,
          partCount: membrane.partIds.length,
          boundedBySparIds: membrane.boundedBySparIds
        }))
      });

const lateralSide = (
  slot: AuthoringSlotAssignment
): 'left' | 'right' | null => {
  const left = slot.spatialRelations.includes('left');
  const right = slot.spatialRelations.includes('right');
  return left === right ? null : left ? 'left' : 'right';
};

/**
 * Paired subtrees correspond by semantic ownership, not literal slot IDs.
 * A centered parent is shared by exact ID; a paired parent is matched through
 * its pair ID on the same semantic side as the child. Asymmetric parents have
 * no well-defined reflected counterpart and therefore cannot parent a paired
 * child.
 */
const pairedParentSignature = (
  slot: AuthoringSlotAssignment,
  slotsById: ReadonlyMap<string, AuthoringSlotAssignment>
): readonly string[] | null => {
  const side = lateralSide(slot);
  if (!side) return null;
  const signature: string[] = [];
  for (const parentSlotId of slot.parentSlotIds) {
    const parent = slotsById.get(parentSlotId);
    if (!parent || parent.symmetry.kind === 'asymmetric') return null;
    if (parent.symmetry.kind === 'centered') {
      signature.push(`centered:${parent.slotId}`);
      continue;
    }
    if (lateralSide(parent) !== side) return null;
    signature.push(`paired:${parent.symmetry.pairId}`);
  }
  return signature.sort((left, right) => left.localeCompare(right));
};

const validateSpatialContracts = (
  slots: readonly AuthoringSlotAssignment[],
  intent: ProjectIntent | undefined,
  issues: AuthoringProfileIssue[]
): void => {
  const slotsById = new Map(slots.map((slot) => [slot.slotId, slot]));
  const paired = new Map<string, AuthoringSlotAssignment[]>();
  for (const slot of slots) {
    if (slot.symmetry.kind !== 'paired') continue;
    paired.set(slot.symmetry.pairId, [
      ...(paired.get(slot.symmetry.pairId) ?? []),
      slot
    ]);
  }
  for (const [pairId, pair] of paired) {
    const sides = pair.flatMap((slot) => {
      const left = slot.spatialRelations.includes('left');
      const right = slot.spatialRelations.includes('right');
      return left === right ? [] : [left ? 'left' : 'right'];
    });
    const leftSlot = pair.find((slot) => lateralSide(slot) === 'left');
    const rightSlot = pair.find((slot) => lateralSide(slot) === 'right');
    const leftParents = leftSlot
      ? pairedParentSignature(leftSlot, slotsById)
      : null;
    const rightParents = rightSlot
      ? pairedParentSignature(rightSlot, slotsById)
      : null;
    const symmetricParents = leftParents !== null &&
      rightParents !== null &&
      canonicalJsonString(leftParents) === canonicalJsonString(rightParents);
    const symmetric = pair.length === 2 &&
      new Set(pair.map((slot) => slot.structuralRole)).size === 1 &&
      new Set(pair.map((slot) => slot.qualityStage)).size === 1 &&
      new Set(pair.map((slot) => supportSignature(slot.support))).size === 1 &&
      new Set(pair.map((slot) => spanSignature(slot.span))).size === 1 &&
      symmetricParents &&
      sides.length === 2 &&
      new Set(sides).size === 2;
    if (!symmetric) {
      addIssue(
        issues,
        'slots',
        `Pair "${pairId}" must contain exactly two isomorphic semantic slots with one left and one right member.`,
        'two same-role, stage, support/span shape, and semantically corresponding centered/paired parents carrying complementary left/right relations'
      );
    }
  }

  const root = slots.find((slot) => slot.parentSlotIds.length === 0);
  const projectSymmetry = intent?.symmetry;
  if (projectSymmetry?.kind === 'bilateral') {
    if (root?.symmetry.kind !== 'centered') {
      addIssue(
        issues,
        'slots',
        'A bilateral project requires its root core slot to be centered.',
        'root symmetry {kind:"centered"}'
      );
    }
    for (const slot of slots) {
      if (slot.symmetry.kind !== 'asymmetric') continue;
      addIssue(
        issues,
        `slots.${slot.slotId}.symmetry`,
        `Bilateral project slot "${slot.slotId}" cannot declare asymmetric ownership.`,
        'centered or paired slot symmetry; use asymmetric project intent for intentional asymmetry'
      );
    }
  } else if (projectSymmetry?.kind === 'asymmetric') {
    const nonAsymmetric = slots.find(
      (slot) => slot.symmetry.kind !== 'asymmetric'
    );
    if (nonAsymmetric) {
      addIssue(
        issues,
        `slots.${nonAsymmetric.slotId}.symmetry`,
        'Centered or paired slots require a bilateral project frame.',
        '{kind:"asymmetric"}'
      );
    }
  }
  for (const slot of slots) {
    const left = slot.spatialRelations.includes('left');
    const right = slot.spatialRelations.includes('right');
    if (slot.symmetry.kind === 'paired' && left === right) {
      addIssue(
        issues,
        `slots.${slot.slotId}.spatialRelations`,
        'A paired slot must declare exactly one lateral side.',
        'one of left or right'
      );
    }
    if (slot.symmetry.kind === 'centered' && (left || right)) {
      addIssue(
        issues,
        `slots.${slot.slotId}.spatialRelations`,
        'A centered slot cannot also claim a lateral side.',
        'no left or right spatial relation'
      );
    }
  }

  const groundedSupport = slots.some((slot) =>
    slot.support.kind !== 'none' && slot.support.contact === 'grounded'
  );
  if (intent?.grounding === 'grounded' && !groundedSupport) {
    addIssue(
      issues,
      'slots',
      'Grounded project intent requires at least one grounded typed support.',
      'base or foot support with contact:"grounded"'
    );
  }
  if (intent?.grounding === 'airborne' && groundedSupport) {
    addIssue(
      issues,
      'slots',
      'Airborne project intent cannot declare grounded support.',
      'support kind none or contact:"free"'
    );
  }
};

export const validateAuthoringSlotGraph = (
  slots: readonly AuthoringSlotAssignment[],
  intent: ProjectIntent | undefined,
  issues: AuthoringProfileIssue[]
): void => {
  validateParentReferences(slots, issues);
  validateRootedStages(slots, issues);
  validateSpatialContracts(slots, intent, issues);
};
