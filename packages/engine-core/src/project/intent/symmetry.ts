import type { ProjectSymmetry } from '../../model';
import { PROJECT_SYMMETRY_MAX_PLANE_TWICE } from '../frame';
import { ProjectIntentIssueCollector } from './result';
import { isIntentRecord } from './value';

const planeExpected =
  `safe integer from -${PROJECT_SYMMETRY_MAX_PLANE_TWICE} through ` +
  `${PROJECT_SYMMETRY_MAX_PLANE_TWICE}`;

const validPlane = (value: unknown): value is number =>
  Number.isSafeInteger(value) &&
  Math.abs(value as number) <= PROJECT_SYMMETRY_MAX_PLANE_TWICE;

const normalizedPlane = (value: number): number =>
  Object.is(value, -0) ? 0 : value;

export const normalizeIntentSymmetry = (
  value: unknown,
  issues: ProjectIntentIssueCollector
): ProjectSymmetry | null => {
  if (!isIntentRecord(value)) {
    issues.add(
      'symmetry',
      'Project symmetry must be an explicit object.',
      '{kind:"asymmetric",pairPlaneTwice?:safe integer} | ' +
        '{kind:"bilateral",planeTwice:safe integer}'
    );
    return null;
  }
  if (value.kind === 'asymmetric') {
    const unknownKey = Object.keys(value).find(
      (key) => key !== 'kind' && key !== 'pairPlaneTwice'
    );
    if (unknownKey) {
      issues.addAt(
        'symmetry',
        unknownKey,
        'Unknown asymmetric symmetry property.',
        'kind, pairPlaneTwice'
      );
      return null;
    }
    if (value.pairPlaneTwice === undefined) return { kind: 'asymmetric' };
    if (!validPlane(value.pairPlaneTwice)) {
      issues.addAt(
        'symmetry',
        'pairPlaneTwice',
        'Local pair reflection plane is outside the project lattice.',
        planeExpected
      );
      return null;
    }
    return {
      kind: 'asymmetric',
      pairPlaneTwice: normalizedPlane(value.pairPlaneTwice)
    };
  }
  if (value.kind !== 'bilateral') {
    issues.addAt(
      'symmetry',
      'kind',
      'Unknown project symmetry kind.',
      'asymmetric | bilateral'
    );
    return null;
  }
  const unknownKey = Object.keys(value).find(
    (key) => key !== 'kind' && key !== 'planeTwice'
  );
  if (unknownKey) {
    issues.addAt(
      'symmetry',
      unknownKey,
      'Unknown bilateral symmetry property.',
      'kind, planeTwice'
    );
  }
  if (!validPlane(value.planeTwice)) {
    issues.addAt(
      'symmetry',
      'planeTwice',
      'Bilateral reflection plane is outside the project lattice.',
      planeExpected
    );
    return null;
  }
  if (unknownKey) return null;
  return {
    kind: 'bilateral',
    planeTwice: normalizedPlane(value.planeTwice)
  };
};
