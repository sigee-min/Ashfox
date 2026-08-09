import { PROJECT_APPEARANCE_SPECIFICATION } from '../contract';
import type { IntentProgramToken } from '../../program/lexer';
import type { RawIntentProgramAppearance } from '../../program/syntax';
import { intentProgramAllowsOccurrence } from '../../program/schema';
import {
  AppearanceLineCursor,
  appearanceVocabularies,
  type AppearanceSourceReporter
} from './contract';

export const readTextureSource = (
  raw: RawIntentProgramAppearance,
  keyword: IntentProgramToken,
  values: readonly IntentProgramToken[],
  reporter: AppearanceSourceReporter
): void => {
  const schema = PROJECT_APPEARANCE_SPECIFICATION.statements.texture;
  const [kindField, scaleField, densityField, contrastField] = schema.order;
  const cursor = new AppearanceLineCursor(
    values,
    keyword,
    reporter,
    'intent.invalid_appearance_texture'
  );
  const kind = cursor.vocabulary(
    appearanceVocabularies[schema.values[kindField]],
    kindField
  );
  cursor.word(schema.markers[scaleField]);
  const scale = cursor.vocabulary(
    appearanceVocabularies[schema.values[scaleField]],
    scaleField
  );
  cursor.word(schema.markers[densityField]);
  const density = cursor.vocabulary(
    appearanceVocabularies[schema.values[densityField]],
    densityField
  );
  cursor.word(schema.markers[contrastField]);
  const contrast = cursor.vocabulary(
    appearanceVocabularies[schema.values[contrastField]],
    contrastField
  );
  cursor.complete();
  if (!cursor.valid || !kind || !scale || !density || !contrast) return;
  if (!intentProgramAllowsOccurrence(
    raw.texture === undefined ? 0 : 1,
    schema.cardinality
  )) {
    reporter.error(
      'intent.duplicate_appearance_texture',
      'appearance texture is declared more than once.',
      kind
    );
    return;
  }
  raw.texture = {
    kind: kind.value,
    scale: scale.value,
    density: density.value,
    contrast: contrast.value
  };
  reporter.field('appearance.texture', kind.value, kind.span);
  reporter.field('appearance.texture.kind', kind.value, kind.span);
  reporter.field('appearance.texture.scale', scale.value, scale.span);
  reporter.field('appearance.texture.density', density.value, density.span);
  reporter.field('appearance.texture.contrast', contrast.value, contrast.span);
};
