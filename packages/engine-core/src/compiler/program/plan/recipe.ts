import type { ConstrainedModelRecipe, ModelPartSpec } from '../../../model';
import { normalizePartRecipe } from '../../../modeling/recipe';
import type {
  IntentProgramDiagnostic,
  IntentProgramIr,
  IntentProgramSpan
} from '../../../project/program/types';
import { intentProgramDiagnostic } from '../diagnostic';
import { sourcePathForRecipeIssue } from '../source/owner';

const PALETTES = {
  natural: ['#738A6D', '#20242A', '#10131A', '#C38B4A'],
  ember: ['#7C3025', '#241719', '#110D0F', '#E89A35'],
  ocean: ['#285E78', '#142630', '#0B1218', '#68B8C7'],
  noir: ['#4B4D54', '#18191D', '#090A0C', '#B7BAC0'],
  metal: ['#65717B', '#252C33', '#0A0E12', '#C48C47'],
  gold: ['#8C682C', '#332714', '#161006', '#E6B84E']
} as const;

export const intentProgramAccentColor = (
  palette: IntentProgramIr['appearance']['palette']
): string => PALETTES[palette][3];

export type IntentProgramRecipeResult =
  | { readonly ok: true; readonly recipe: ConstrainedModelRecipe }
  | { readonly ok: false; readonly diagnostics: readonly IntentProgramDiagnostic[] };

/** Converts emitted primitives into the normalized recipe/material boundary. */
export const compileIntentProgramRecipe = (
  parts: readonly ModelPartSpec[],
  sourceMap: Readonly<Record<string, IntentProgramSpan>>,
  palette: IntentProgramIr['appearance']['palette']
): IntentProgramRecipeResult => {
  if (!(palette in PALETTES)) {
    return {
      ok: false,
      diagnostics: [intentProgramDiagnostic(
        sourceMap,
        'appearance.palette',
        'intent-program.invalid-palette',
        `Palette "${String(palette)}" is not a compiler-owned palette.`
      )]
    };
  }
  const [base, dark, eye, accent] = PALETTES[palette];
  const normalized = normalizePartRecipe(parts, [
    { id: 'mat.base', baseColor: base },
    { id: 'mat.dark', baseColor: dark },
    { id: 'mat.eye', baseColor: eye },
    { id: 'mat.accent', baseColor: accent }
  ]);
  if (normalized.ok) return { ok: true, recipe: normalized.recipe };
  return {
    ok: false,
    diagnostics: normalized.issues.map((issue) => intentProgramDiagnostic(
      sourceMap,
      sourcePathForRecipeIssue(issue.path, parts),
      'intent-program.part-recipe-invalid',
      `${issue.path}: ${issue.message}`
    ))
  };
};
