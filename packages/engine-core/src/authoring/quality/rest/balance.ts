import type { CompiledPartState } from '../../../modeling/invariants';
import type { CellKey } from '../../../modeling/contract';
import { measureStaticSupport } from '../../../modeling/support/metric';
import type {
  AuthoringProfile,
  AuthoringSlotAssignment
} from '../../contract';
import { authoringPlanIssue } from '../issues';
import type { RestQualityStage } from './contract';
import {
  REST_GEOMETRY_EPSILON as EPSILON,
  cellsForParts,
  centroid,
  pointInsideHull
} from './geometry';

export interface GroundedBalanceResult {
  readonly coreAboveSupport: boolean | null;
  readonly centerOfMassSupported: boolean | null;
}

export const evaluateGroundedBalance = (
  profile: AuthoringProfile,
  coreSlot: AuthoringSlotAssignment | undefined,
  supportIds: ReadonlySet<string>,
  presentIds: ReadonlySet<string>,
  missingIds: readonly string[],
  allCells: ReadonlySet<CellKey>,
  parts: ReadonlyMap<string, CompiledPartState>
): RestQualityStage<GroundedBalanceResult> => {
  const groundedMode = profile.restPose.mode === 'standing' ||
    profile.restPose.mode === 'rolling' ||
    profile.restPose.mode === 'supported';
  const inputsComplete = groundedMode && coreSlot !== undefined &&
    coreSlot.partIds.every((partId) => presentIds.has(partId)) &&
    [...supportIds].every((partId) => presentIds.has(partId));
  if (!inputsComplete || !coreSlot) {
    return {
      value: { coreAboveSupport: null, centerOfMassSupported: null },
      issues: [],
      violations: []
    };
  }
  const declaredSupportMetric = measureStaticSupport(
    cellsForParts([...supportIds], parts)
  );
  const wholeMetric = measureStaticSupport(allCells);
  const coreCenter = centroid(cellsForParts(coreSlot.partIds, parts));
  const coreAboveSupport = coreCenter !== null &&
    coreCenter[1] > EPSILON &&
    pointInsideHull(
      [coreCenter[0], coreCenter[2]],
      declaredSupportMetric.supportHull
    );
  const centerOfMassSupported = wholeMetric.centerOfMass !== null &&
    pointInsideHull(
      wholeMetric.centerOfMass,
      declaredSupportMetric.supportHull
    );
  const issue = !coreAboveSupport ||
    (missingIds.length === 0 && !centerOfMassSupported)
    ? authoringPlanIssue(
        'authoring.plan.rest_pose_balance_invalid',
        'authoringProfile.restPose',
        !coreAboveSupport
          ? 'Canonical core is not vertically above the declared support hull.'
          : 'Canonical uniform-volume center of mass falls outside the declared support hull.',
        'core and completed-model center of mass projected inside the declared grounded support hull, with core above lattice ground',
        { partIds: coreSlot.partIds }
      )
    : null;
  return {
    value: { coreAboveSupport, centerOfMassSupported },
    issues: issue ? [issue] : [],
    violations: issue && (missingIds.length === 0 || !coreAboveSupport)
      ? [issue]
      : []
  };
};
