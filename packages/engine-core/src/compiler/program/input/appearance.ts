import { canonicalJsonString } from '../../../canonicalJson';
import { normalizeProjectAppearanceIntent } from '../../../project/appearance/reader';
import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from '../../../project/program/language';
import {
  isInputRecord,
  reportUnknownInputKeys,
  type IntentProgramInputRecord,
  type IntentProgramInputReporter
} from './contract';

const appearanceKeys = new Set([
  'palette', 'version', 'seed', 'texture', 'markings'
]);

export const validateIntentProgramAppearanceInput = (
  candidate: IntentProgramInputRecord,
  report: IntentProgramInputReporter
): void => {
  const appearance = isInputRecord(candidate.appearance)
    ? candidate.appearance
    : undefined;
  if (!appearance || typeof appearance.palette !== 'string' ||
    !INTENT_PROGRAM_LANGUAGE_SPECIFICATION.appearance.palettes.some(
      (palette) => palette === appearance.palette
    )) report(
    'appearance.palette',
    'intent-program.invalid-normalized-palette',
    'A compiler input requires one declared canonical palette.'
  );
  if (appearance) reportUnknownInputKeys(
    appearance, appearanceKeys, 'appearance',
    'intent-program.unknown-normalized-property', 'Appearance', report
  );
  const projection = appearance ? {
    version: appearance.version,
    seed: appearance.seed,
    texture: appearance.texture,
    markings: appearance.markings
  } : undefined;
  const issues: Parameters<typeof normalizeProjectAppearanceIntent>[1] = [];
  const normalized = normalizeProjectAppearanceIntent(projection, issues);
  for (const entry of issues) report(
    entry.path,
    'intent-program.invalid-normalized-appearance',
    entry.message
  );
  if (normalized && canonicalJsonString(projection) !==
    canonicalJsonString(normalized)) report(
    'appearance',
    'intent-program.noncanonical-normalized-appearance',
    'Compiler appearance markings must use canonical stable-ID order.'
  );
};
