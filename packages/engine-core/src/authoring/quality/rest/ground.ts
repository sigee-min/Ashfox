import type { CompiledPartState } from '../../../modeling/invariants';
import { parseCellKey } from '../../../modeling/lattice';
import type { AuthoringProfile } from '../../contract';
import { authoringPlanIssue } from '../issues';
import type { RestQualityStage } from './contract';
import { compareStableText } from '../../../stableOrder';

export interface GroundContractResult {
  readonly groundContactPartIds: readonly string[];
  readonly nonSupportGroundContactPartIds: readonly string[];
}

const hasCellAt = (
  part: CompiledPartState,
  predicate: (y: number) => boolean
): boolean => {
  for (const key of part.occupancy.cells) {
    if (predicate(parseCellKey(key).y)) return true;
  }
  return false;
};

export const evaluateGroundContract = (
  profile: AuthoringProfile,
  supportIds: ReadonlySet<string>,
  parts: ReadonlyMap<string, CompiledPartState>
): RestQualityStage<GroundContractResult> => {
  const groundContactPartIds = [...parts.values()]
    .filter((part) => hasCellAt(part, (y) => y === 0))
    .map((part) => part.partId)
    .sort(compareStableText);
  const groundedMode = profile.restPose.mode === 'standing' ||
    profile.restPose.mode === 'rolling' ||
    profile.restPose.mode === 'supported';
  const nonSupportGroundContactPartIds = groundedMode
    ? groundContactPartIds.filter((partId) => !supportIds.has(partId))
    : [];
  const contactIssue = nonSupportGroundContactPartIds.length === 0
    ? null
    : authoringPlanIssue(
        'authoring.plan.rest_pose_ground_contact_invalid',
        'modeling.parts',
        'Canonical grounded rest has y=0 contact outside declared support regions.',
        'only declared grounded foot, wheel, or base support parts may own lattice y=0 cells',
        { partIds: nonSupportGroundContactPartIds }
      );
  const forbidden = profile.restPose.mode === 'none'
    ? (y: number): boolean => y <= 0
    : (y: number): boolean => y < 0;
  const unclearedPartIds = [...parts.values()]
    .filter((part) => hasCellAt(part, forbidden))
    .map((part) => part.partId)
    .sort(compareStableText);
  const clearanceIssue = unclearedPartIds.length === 0
    ? null
    : authoringPlanIssue(
        'authoring.plan.rest_pose_clearance_invalid',
        'modeling.parts',
        profile.restPose.mode === 'none'
          ? 'Canonical contact-free rest must remain strictly above lattice ground.'
          : `Canonical ${profile.restPose.mode} rest penetrates below lattice ground.`,
        profile.restPose.mode === 'none'
          ? 'every compiled occupancy cell at lattice y>0'
          : profile.restPose.mode === 'free-explicit'
            ? 'free-explicit rest may touch the y=0 reference plane but every compiled cell must remain at lattice y>=0'
            : 'every compiled occupancy cell at lattice y>=0',
        { partIds: unclearedPartIds }
      );
  const issues = [contactIssue, clearanceIssue].filter(
    (issue) => issue !== null
  );
  return {
    value: { groundContactPartIds, nonSupportGroundContactPartIds },
    issues,
    violations: issues
  };
};
