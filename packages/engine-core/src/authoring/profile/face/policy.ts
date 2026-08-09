import {
  addAuthoringProfileIssue as addIssue,
  type AuthoringProfileIssue
} from '../evidence';
import { authoringTrackPolicy } from '../tracks';
import {
  AUTHORING_FACE_COMPONENTS,
  authoringFaceComponentSlotIds,
  type AuthoringFaceComponent,
  type AuthoringFaceComponentDeclaration,
  type AuthoringFaceContract,
  type AuthoringFaceException,
  type AuthoringTrack
} from '../../contract';

export const validateAuthoringFaceDeclarations = (
  track: AuthoringTrack | null,
  mouthState: AuthoringFaceContract['mouthState'] | null,
  components: readonly AuthoringFaceComponentDeclaration[],
  exceptions: readonly AuthoringFaceException[],
  issues: AuthoringProfileIssue[]
): void => {
  for (const component of AUTHORING_FACE_COMPONENTS) {
    if (components.filter((entry) => entry.component === component).length > 1) {
      addIssue(
        issues,
        'face.components',
        `Face component "${component}" may be declared only once.`,
        'one declaration per semantic component'
      );
    }
  }
  const slotOwners = new Map<string, AuthoringFaceComponent[]>();
  for (const component of components) {
    for (const slotId of authoringFaceComponentSlotIds(component)) {
      slotOwners.set(slotId, [
        ...(slotOwners.get(slotId) ?? []),
        component.component
      ]);
    }
  }
  for (const [slotId, owners] of slotOwners) {
    if (owners.length > 1) {
      addIssue(
        issues,
        'face.components',
        `Face slot "${slotId}" is reused across semantic components.`,
        'component-exclusive descendant slots with explicit parts'
      );
    }
  }
  for (const component of ['nasal', 'oral'] as const) {
    const matches = exceptions.filter((entry) => entry.component === component);
    if (matches.length > 1) {
      addIssue(
        issues,
        'face.exceptions',
        `Species exception "${component}" may be declared only once.`,
        'at most one exception per omittable component'
      );
    }
    if (
      matches.length > 0 &&
      components.some((entry) => entry.component === component)
    ) {
      addIssue(
        issues,
        'face',
        `Face component "${component}" cannot be both realized and excepted.`,
        'either one actual component or one species exception'
      );
    }
  }
  const has = (component: AuthoringFaceComponent): boolean =>
    components.some((entry) => entry.component === component);
  const excepted = (component: 'nasal' | 'oral'): boolean =>
    exceptions.some((entry) => entry.component === component);
  const policy = track === null ? null : authoringTrackPolicy(track);
  for (const component of policy?.face.requiredComponents ?? []) {
    const satisfied = has(component) ||
      (component === 'nasal' && excepted('nasal')) ||
      (component === 'oral' && excepted('oral'));
    if (satisfied) continue;
    addIssue(
      issues,
      'face.components',
      `${policy?.label ?? 'Selected'} full face requires a ${component} component.`,
      component === 'eye'
        ? 'one readable configured eye component'
        : component === 'nasal'
          ? 'nose, muzzle, beak, or nasal species exception'
          : component === 'oral'
            ? 'mouth, jaw, beak, or oral species exception'
            : `one exclusive ${component} component`
    );
  }
  if (mouthState === 'absent') {
    if (!excepted('oral') || has('oral') || has('jaw') || has('mouth-interior')) {
      addIssue(
        issues,
        'face.mouthState',
        'Absent mouth must match one oral species exception and no oral geometry.',
        'mouthState absent + oral exception + no oral/jaw/mouth-interior component'
      );
    }
  } else if (mouthState) {
    const oral = components.find((entry) => entry.component === 'oral');
    if (!oral || excepted('oral')) {
      addIssue(
        issues,
        'face.components',
        'Present mouth state requires an actual oral component.',
        'one oral component and no oral exception'
      );
    }
    if (mouthState === 'beak' && oral?.form !== 'beak') {
      addIssue(
        issues,
        'face.mouthState',
        'Beak mouth state requires a beak oral form.',
        'oral form beak'
      );
    }
    if (mouthState !== 'beak' && oral?.form === 'beak') {
      addIssue(
        issues,
        'face.mouthState',
        'Beak oral form requires mouthState beak.',
        'mouthState beak'
      );
    }
  }
  if (
    policy?.face.requireJawWhenMouthPresent &&
    mouthState !== 'absent' &&
    !has('jaw')
  ) {
    addIssue(
      issues,
      'face.components',
      `${policy.label} full face requires a separate jaw.`,
      'one jaw component'
    );
  }
  if (
    policy?.face.requireInteriorWhenMouthOpen &&
    mouthState === 'open' &&
    !has('mouth-interior')
  ) {
    addIssue(
      issues,
      'face.components',
      `Open ${policy.label} face requires a separate mouth interior.`,
      'one mouth-interior component'
    );
  }
  if (mouthState !== 'open' && has('mouth-interior')) {
    addIssue(
      issues,
      'face.components',
      'Mouth interior is only valid for an open mouth state.',
      'remove mouth-interior or set mouthState open'
    );
  }
};
