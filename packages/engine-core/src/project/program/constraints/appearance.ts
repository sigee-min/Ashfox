import { normalizeIntentProgramAppearance } from '../../appearance/normalize';
import type { ProjectAppearanceV1 } from '../../appearance/contract';
import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from '../language';
import { addConstraintIssue, type ConstraintState } from './analysis';
import { intentProgramCardinalityBounds } from '../schema';

const reportMissingAppearance = (state: ConstraintState): void => {
  const statements =
    INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.appearance;
  const required: readonly [number, unknown, string, string][] = [
    [intentProgramCardinalityBounds(statements.palette.cardinality).min,
      state.ast.appearance.palette,
      'one palette declaration', 'appearance.palette'],
    [intentProgramCardinalityBounds(statements.texture.schema.cardinality).min,
      state.ast.appearance.texture,
      'one complete texture declaration', 'appearance.texture'],
    [intentProgramCardinalityBounds(statements.seed.schema.cardinality).min,
      state.ast.appearance.seed,
      'seed auto or one explicit seed', 'appearance.seed']
  ];
  for (const [minimum, value, label, path] of required) {
    if (minimum > 0 && value === undefined) addConstraintIssue(
      state,
      'intent.incomplete_appearance',
      `An appearance block requires ${label}.`,
      path
    );
  }
};

export const validateIntentProgramAppearance = (
  state: ConstraintState
): ProjectAppearanceV1 | null => {
  reportMissingAppearance(state);
  state.counters.targetChecks += state.ast.appearance.markings.length;
  const face = state.ast.model.face;
  return normalizeIntentProgramAppearance(
    state.ast.appearance,
    {
      references: {
        body: new Set(state.moduleById.keys()),
        surfaces: new Set(state.surfaceById.keys()),
        face: face?.kind === 'full',
        focal: new Set(
          state.ast.model.focal ? [state.ast.model.focal.id] : []
        )
      }
    },
    {
      reportPath: (code, message, path) =>
        addConstraintIssue(state, code, message, path)
    }
  );
};

export const validateIntentProgramSymmetry = (state: ConstraintState): void => {
  const rule = INTENT_PROGRAM_LANGUAGE_SPECIFICATION.symmetryCompatibility
    .singleLateralAttachment;
  if (state.ast.model.symmetry !== rule.whenSymmetry) return;
  if (rule.appliesTo.includes('body')) {
    for (const module of state.ast.model.body) {
      if (module.kind !== 'core' && module.cardinality === rule.cardinality &&
        rule.anchors.some((anchor) => anchor === module.anchor)) {
        addConstraintIssue(
          state,
          'intent.single_sided_body_requires_asymmetric',
          `Single ${module.anchor} body module "${module.id}" requires ${rule.requiredSymmetry} symmetry.`,
          `body.${module.id}.anchor`
        );
      }
    }
  }
  if (rule.appliesTo.includes('surface')) {
    for (const surface of state.ast.model.surfaces) {
      if (surface.cardinality === rule.cardinality &&
        rule.anchors.some((anchor) => anchor === surface.anchor)) {
        addConstraintIssue(
          state,
          'intent.single_sided_surface_requires_asymmetric',
          `Single ${surface.anchor} surface "${surface.id}" requires ${rule.requiredSymmetry} symmetry.`,
          `surfaces.${surface.id}.anchor`
        );
      }
    }
  }
};
