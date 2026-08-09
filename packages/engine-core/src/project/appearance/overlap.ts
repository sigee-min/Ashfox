import type { ProjectAppearanceMarking } from './contract';
import { PROJECT_APPEARANCE_SPECIFICATION as SPEC } from './contract';

export interface ProjectAppearanceOverlapIssue {
  readonly path: string;
  readonly message: string;
  readonly expected: string;
}

const targetKey = (marking: ProjectAppearanceMarking): string => {
  const reference = SPEC.statements.mark.targetReferences[marking.target.kind];
  return 'id' in marking.target
    ? `${reference.namespace}:${marking.target.id}`
    : reference.namespace;
};

const regionsOverlap = (
  left: ProjectAppearanceMarking['region'],
  right: ProjectAppearanceMarking['region']
): boolean => {
  const first = SPEC.markingOverlap.regionAxes[left];
  const second = SPEC.markingOverlap.regionAxes[right];
  const opposites = Object.entries(SPEC.markingOverlap.oppositeRegionAxes);
  return !first.some((axis) => opposites.some(
    ([candidate, opposite]) => candidate === axis &&
      second.some((other) => other === opposite)
  ));
};

const placementsOverlap = (
  left: ProjectAppearanceMarking['placement'],
  right: ProjectAppearanceMarking['placement']
): boolean => SPEC.markingOverlap.overlappingPlacements[left]
  .some((placement) => placement === right);

export const collectProjectAppearanceOverlapIssues = (
  markings: readonly ProjectAppearanceMarking[]
): readonly ProjectAppearanceOverlapIssue[] => {
  const issues: ProjectAppearanceOverlapIssue[] = [];
  for (let index = 0; index < markings.length; index += 1) {
    const marking = markings[index]!;
    for (let priorIndex = 0; priorIndex < index; priorIndex += 1) {
      const prior = markings[priorIndex]!;
      if (
        targetKey(marking) === targetKey(prior) &&
        SPEC.motifClasses[marking.motif] === SPEC.motifClasses[prior.motif] &&
        regionsOverlap(marking.region, prior.region) &&
        placementsOverlap(marking.placement, prior.placement)
      ) issues.push({
        path: `appearance.markings.${marking.id}`,
        message:
          `Appearance markings "${prior.id}" and "${marking.id}" have an ambiguous same-class overlap.`,
        expected:
          'disjoint target region or placement, or a different motif class'
      });
    }
  }
  return issues;
};
