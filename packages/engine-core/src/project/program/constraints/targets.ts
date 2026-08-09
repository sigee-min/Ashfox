import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from '../language';
import { resolveIntentProgramVocabulary } from '../schema';
import { addConstraintIssue, type ConstraintState } from './analysis';
import { INTENT_PROGRAM_INVARIANTS } from './policy';

type TargetReferenceName =
  'faceParent' | 'focalParent' | 'animationTarget';
type PresentationClaimKind = 'face' | 'focal';

export const INTENT_PROGRAM_TARGET_REFERENCE_POLICY =
  INTENT_PROGRAM_INVARIANTS.references;
export const INTENT_PROGRAM_TRACK_PRESENTATION_POLICY =
  INTENT_PROGRAM_INVARIANTS.presentationByTrack;

const inspectTarget = (
  state: ConstraintState,
  target: string,
  path: string,
  label: string,
  referenceName: TargetReferenceName
): void => {
  state.counters.targetChecks += 1;
  const reference = INTENT_PROGRAM_TARGET_REFERENCE_POLICY[referenceName];
  const module = reference.namespace === 'body'
    ? state.moduleById.get(target)
    : undefined;
  if (!module) addConstraintIssue(
    state,
    `intent.unknown_${label}_target`,
    `${label} names unknown body target "${target}".`,
    path
  );
  else if (!resolveIntentProgramVocabulary(reference.allowedKinds).some(
    (kind) => kind === module.kind
  )) {
    addConstraintIssue(
      state,
      `intent.unsupported_${label}_target`,
      `${label} cannot target ${module.kind} module "${target}".`,
      path
    );
  }
};

const claimPresentationSlot = (
  state: ConstraintState,
  parent: string,
  claimKind: PresentationClaimKind,
  owner: string,
  path: string,
  storedOwner = owner
): void => {
  const presentation = INTENT_PROGRAM_INVARIANTS.attachmentSlots.presentation;
  if (!presentation.claimKinds.includes(claimKind)) return;
  const claims = state.presentationClaims.get(parent) ?? [];
  if (presentation.exclusiveClaimKinds.includes(claimKind) &&
    claims.length > 0) addConstraintIssue(
    state,
    'intent.presentation_slot_conflict',
    `${owner} conflicts with ${claims.join(', ')} at the presentation slot of "${parent}".`,
    path
  );
  state.presentationClaims.set(parent, [...claims, storedOwner]);
};

export const validateIntentProgramTargets = (state: ConstraintState): void => {
  const { ast } = state;
  const face = ast.model.face;
  if (face?.kind === 'full') {
    inspectTarget(state, face.parent, 'face.parent', 'face', 'faceParent');
    const fields =
      INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.model.face.fields;
    for (const [requiredWhen, value, field] of [
      [fields.parent.required, face.parent, 'parent'],
      [fields.eyes.required, face.eyes, 'eyes'],
      [fields.gaze.required, face.gaze, 'gaze'],
      [fields.nose.required, face.nose, 'nose'],
      [fields.mouth.required, face.mouth, 'mouth']
    ] as const) {
      if (requiredWhen === face.kind && value === undefined) addConstraintIssue(
        state,
        'intent.incomplete_face',
        `A full face requires ${field}.`,
        `face.${field}`
      );
    }
    claimPresentationSlot(
      state, face.parent, 'face', 'Full face', 'face.parent', 'full face'
    );
  }
  const focal = ast.model.focal;
  if (focal) {
    inspectTarget(state, focal.parent, 'focal.parent', 'focal', 'focalParent');
    claimPresentationSlot(
      state,
      focal.parent,
      'focal',
      `Focal "${focal.id}"`,
      'focal.parent',
      `focal "${focal.id}"`
    );
  }
  const idleTarget = ast.animation.idle?.target;
  if (idleTarget) {
    inspectTarget(
      state, idleTarget, 'animation.idle.target', 'animation',
      'animationTarget'
    );
  }
  const activeClaims: PresentationClaimKind[] = [
    ...(face?.kind === 'full' ? ['face' as const] : []),
    ...(focal ? ['focal' as const] : [])
  ];
  const track = ast.metadata.track;
  const trackPolicy = track
    ? INTENT_PROGRAM_TRACK_PRESENTATION_POLICY[track]
    : undefined;
  const governedClaims = trackPolicy
    ? activeClaims.filter((claim) => trackPolicy.claimKinds.includes(claim))
    : [];
  if (track === 'hero' && trackPolicy && trackPolicy.exactClaimCount !== null &&
    governedClaims.length !== trackPolicy.exactClaimCount) {
    addConstraintIssue(
      state,
      'intent.hero_requires_one_focal_stage',
      'Hero track requires exactly one focal stage: a full face or a focal declaration.',
      focal ? 'focal' : 'face'
    );
  }
  if (track === 'essential' && trackPolicy &&
    trackPolicy.forbiddenClaimKinds.some(
    (claim) => activeClaims.includes(claim)
  )) addConstraintIssue(
    state,
    'intent.focal_requires_hero_track',
    'A focal declaration is available only on the hero track.',
    'focal'
  );
};
