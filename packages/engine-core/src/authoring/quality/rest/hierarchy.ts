import type { CompiledPartState } from '../../../modeling/invariants';
import { parseCellKey } from '../../../modeling/lattice';
import { compareStableText } from '../../../stableOrder';
import type {
  AuthoringProfile,
  AuthoringSlotAssignment
} from '../../contract';
import { authoringPlanIssue } from '../issues';
import type { RestQualityStage } from './contract';
import {
  CANONICAL_STANDING_EXTENSION_POLICY,
  REST_GEOMETRY_EPSILON as EPSILON,
  cellsForParts,
  centroid,
  chainDescends,
  chainToCore
} from './geometry';

export interface StandingHierarchyResult {
  readonly invalidHierarchyPartIds: readonly string[];
  readonly invalidDescentPartIds: readonly string[];
}

const coreHasStandingClearance = (
  coreSlot: AuthoringSlotAssignment,
  supportIds: ReadonlySet<string>,
  parts: ReadonlyMap<string, CompiledPartState>
): boolean => {
  const coreCenter = centroid(cellsForParts(coreSlot.partIds, parts));
  const supportCells = cellsForParts([...supportIds], parts);
  if (!coreCenter || supportCells.size === 0) return false;
  const supportTop = Math.max(
    ...[...supportCells].map((key) => parseCellKey(key).y + 1)
  );
  return coreCenter[1] - supportTop >=
    CANONICAL_STANDING_EXTENSION_POLICY.minimumCoreCentroidClearanceCells -
      EPSILON;
};

const emptyHierarchy = (): RestQualityStage<StandingHierarchyResult> => ({
  value: { invalidHierarchyPartIds: [], invalidDescentPartIds: [] },
  issues: [],
  violations: []
});

export const evaluateStandingHierarchy = (
  profile: AuthoringProfile,
  coreSlot: AuthoringSlotAssignment | undefined,
  supportSlots: readonly AuthoringSlotAssignment[],
  supportIds: ReadonlySet<string>,
  presentIds: ReadonlySet<string>,
  parts: ReadonlyMap<string, CompiledPartState>
): RestQualityStage<StandingHierarchyResult> => {
  if (profile.restPose.mode !== 'standing' || !coreSlot) {
    return emptyHierarchy();
  }
  const invalidHierarchyPartIds: string[] = [];
  const invalidDescentPartIds: string[] = [];
  const coreComplete = coreSlot.partIds.every((partId) => presentIds.has(partId));
  const coreIds = new Set(coreSlot.partIds);
  for (const slot of supportSlots) {
    if (
      slot.support.kind !== 'foot' ||
      !presentIds.has(slot.support.rootPartId) ||
      !coreComplete
    ) {
      continue;
    }
    const chain = chainToCore(slot.support.rootPartId, coreIds, parts);
    if (!chain) invalidHierarchyPartIds.push(slot.support.rootPartId);
    else if (!chainDescends(chain)) {
      invalidDescentPartIds.push(slot.support.rootPartId);
    }
  }
  const supportComplete = [...supportIds].every((partId) => presentIds.has(partId));
  if (
    coreComplete &&
    supportComplete &&
    !coreHasStandingClearance(coreSlot, supportIds, parts)
  ) {
    invalidDescentPartIds.push(...coreSlot.partIds);
  }
  const hierarchyIssue = invalidHierarchyPartIds.length === 0
    ? null
    : authoringPlanIssue(
        'authoring.plan.rest_pose_hierarchy_invalid',
        'authoringProfile.restPose',
        'Standing foot roots do not descend through the canonical core hierarchy.',
        'every grounded foot root must have a compiled parent chain reaching the root core',
        { partIds: invalidHierarchyPartIds }
      );
  const descentIssue = invalidDescentPartIds.length === 0
    ? null
    : authoringPlanIssue(
        'authoring.plan.rest_pose_descent_invalid',
        'authoringProfile.restPose',
        'Standing core-to-foot chains do not realize canonical vertical extension.',
        'non-rising chains whose vertical drop covers at least half of centroid-chain length and leaves the core centroid at least one cell above support-top; lateral exterior ports are validated separately by exact bilateral reflection',
        { partIds: invalidDescentPartIds }
      );
  const issues = [hierarchyIssue, descentIssue].filter(
    (issue) => issue !== null
  );
  return {
    value: {
      invalidHierarchyPartIds: invalidHierarchyPartIds.sort(compareStableText),
      invalidDescentPartIds: [...new Set(invalidDescentPartIds)]
        .sort(compareStableText)
    },
    issues,
    violations: issues
  };
};
