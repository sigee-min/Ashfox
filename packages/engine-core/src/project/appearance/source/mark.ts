import type {
  ProjectAppearanceFlow,
  ProjectAppearanceMarking,
  ProjectAppearanceTarget,
  ProjectAppearanceTargetKind
} from '../contract';
import { PROJECT_APPEARANCE_SPECIFICATION } from '../contract';
import type { IntentProgramToken } from '../../program/lexer';
import type {
  IntentProgramWordToken,
  RawIntentProgramAppearance
} from '../../program/syntax';
import { intentProgramAllowsOccurrence } from '../../program/schema';
import {
  AppearanceLineCursor,
  appearanceVocabularies,
  type AppearanceSourceReporter
} from './contract';

const readTarget = (
  cursor: AppearanceLineCursor,
  vocabulary: readonly ProjectAppearanceTargetKind[],
  references: typeof PROJECT_APPEARANCE_SPECIFICATION.statements.mark[
    'targetReferences'
  ]
): {
  target: ProjectAppearanceTarget;
  kindToken: IntentProgramWordToken;
  idToken?: IntentProgramWordToken;
} | null => {
  const kind = cursor.vocabulary(vocabulary, 'target');
  if (!kind) return null;
  if (references[kind.value].idCardinality === 0) {
    return { target: { kind: 'face' }, kindToken: kind };
  }
  const id = cursor.identifier(`An appearance ${kind.value} target ID`);
  return id
    ? { target: { kind: kind.value, id: id.value }, kindToken: kind, idToken: id }
    : null;
};

const recordFields = (
  marking: ProjectAppearanceMarking,
  tokens: {
    id: IntentProgramWordToken;
    target: IntentProgramWordToken;
    targetId?: IntentProgramWordToken;
    region: IntentProgramWordToken;
    placement: IntentProgramWordToken;
    motif: IntentProgramWordToken;
    tone: IntentProgramWordToken;
    flow?: IntentProgramWordToken;
    variant?: IntentProgramWordToken;
    scale: IntentProgramWordToken;
    density: IntentProgramWordToken;
    contrast: IntentProgramWordToken;
  },
  reporter: AppearanceSourceReporter
): void => {
  const path = `appearance.markings.${marking.id}`;
  reporter.field(path, marking.id, tokens.id.span);
  reporter.field(`${path}.id`, marking.id, tokens.id.span);
  reporter.field(`${path}.target`, marking.target.kind, tokens.target.span);
  reporter.field(`${path}.target.kind`, marking.target.kind, tokens.target.span);
  if (marking.target.kind !== 'face' && tokens.targetId) {
    reporter.field(`${path}.target.id`, marking.target.id, tokens.targetId.span);
  }
  reporter.field(`${path}.region`, marking.region, tokens.region.span);
  reporter.field(`${path}.placement`, marking.placement, tokens.placement.span);
  reporter.field(`${path}.motif`, marking.motif, tokens.motif.span);
  reporter.field(`${path}.tone`, marking.tone, tokens.tone.span);
  if (marking.flow && tokens.flow) {
    reporter.field(`${path}.flow`, marking.flow, tokens.flow.span);
  }
  if (marking.variant && tokens.variant) {
    reporter.field(`${path}.variant`, marking.variant, tokens.variant.span);
  }
  reporter.field(`${path}.scale`, marking.scale, tokens.scale.span);
  reporter.field(`${path}.density`, marking.density, tokens.density.span);
  reporter.field(`${path}.contrast`, marking.contrast, tokens.contrast.span);
};

export const readMarkSource = (
  raw: RawIntentProgramAppearance,
  keyword: IntentProgramToken,
  values: readonly IntentProgramToken[],
  reporter: AppearanceSourceReporter
): void => {
  const schema = PROJECT_APPEARANCE_SPECIFICATION.statements.mark;
  const [
    idField,
    targetField,
    regionField,
    placementField,
    motifField,
    toneField,
    flowField,
    variantField,
    scaleField,
    densityField,
    contrastField
  ] = schema.order;
  const cursor = new AppearanceLineCursor(
    values,
    keyword,
    reporter,
    'intent.invalid_appearance_mark'
  );
  const id = cursor.identifier(`An appearance mark ${idField}`);
  cursor.word(schema.markers[targetField]);
  const target = readTarget(
    cursor,
    appearanceVocabularies[schema.values[targetField]],
    schema.targetReferences
  );
  cursor.word(schema.markers[regionField]);
  const region = cursor.vocabulary(
    appearanceVocabularies[schema.values[regionField]],
    regionField
  );
  cursor.word(schema.markers[placementField]);
  const placement = cursor.vocabulary(
    appearanceVocabularies[schema.values[placementField]],
    placementField
  );
  cursor.word(schema.markers[motifField]);
  const motif = cursor.vocabulary(
    appearanceVocabularies[schema.values[motifField]],
    motifField
  );
  cursor.word(schema.markers[toneField]);
  const tone = cursor.vocabulary(
    appearanceVocabularies[schema.values[toneField]],
    toneField
  );
  let flow: IntentProgramWordToken<ProjectAppearanceFlow> | undefined;
  if (schema.optional.includes(flowField) &&
    cursor.has(schema.markers[flowField])) {
    cursor.word(schema.markers[flowField]);
    flow = cursor.vocabulary(
      appearanceVocabularies[schema.values[flowField]],
      flowField
    ) ?? undefined;
  }
  let variant: IntentProgramWordToken | undefined;
  if (schema.optional.includes(variantField) &&
    cursor.has(schema.markers[variantField])) {
    cursor.word(schema.markers[variantField]);
    variant = cursor.identifier(`An appearance mark ${variantField}`) ?? undefined;
  }
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
  if (!cursor.valid || !id || !target || !region || !placement || !motif ||
    !tone || !scale || !density || !contrast) return;
  const maximum = PROJECT_APPEARANCE_SPECIFICATION[
    schema.cardinality.maximum
  ];
  if (!intentProgramAllowsOccurrence(raw.markings.length, maximum)) {
    reporter.error(
      'intent.too_many_appearance_marks',
      `Appearance accepts at most ${maximum} marks.`,
      id
    );
    return;
  }
  if (schema.identity.unique && raw.markings.some(
    (candidate) => candidate[schema.identity.field] === id.value
  )) {
    reporter.error(
      'intent.duplicate_appearance_mark',
      `Appearance mark "${id.value}" is declared more than once.`,
      id
    );
    return;
  }
  const marking: ProjectAppearanceMarking = {
    id: id.value,
    target: target.target,
    region: region.value,
    placement: placement.value,
    motif: motif.value,
    tone: tone.value,
    ...(flow ? { flow: flow.value } : {}),
    ...(variant ? { variant: variant.value } : {}),
    scale: scale.value,
    density: density.value,
    contrast: contrast.value
  };
  raw.markings.push(marking);
  recordFields(marking, {
    id,
    target: target.kindToken,
    ...(target.idToken ? { targetId: target.idToken } : {}),
    region,
    placement,
    motif,
    tone,
    ...(flow ? { flow } : {}),
    ...(variant ? { variant } : {}),
    scale,
    density,
    contrast
  }, reporter);
};
