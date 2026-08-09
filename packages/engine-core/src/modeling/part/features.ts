import {
  EYE_GLYPHS,
  FEATURE_GLYPHS,
  FEATURE_MOTIFS,
  MOUTH_GLYPHS,
  NOSE_GLYPHS,
  PART_FACES,
  addIssue,
  parseEnum,
  parseExtent,
  parseVec2,
  parseVec3
} from './primitives';
import type {
  FeaturePartSpec,
  ParsedCommon,
  ParsedPart,
  PartContractIssue,
  UnknownRecord
} from './contract';

export const parseFeature = (
  input: UnknownRecord,
  common: ParsedCommon,
  path: string,
  issues: PartContractIssue[]
): ParsedPart => {
  const motif = parseEnum(input.motif, FEATURE_MOTIFS, `${path}.motif`, issues);
  const glyph = input.glyph === undefined
    ? undefined
    : parseEnum(input.glyph, FEATURE_GLYPHS, `${path}.glyph`, issues);
  const face = parseEnum(input.face, PART_FACES, `${path}.face`, issues);
  const anchor = parseVec3(input.anchor, `${path}.anchor`, issues);
  const size = parseVec2(input.size, `${path}.size`, issues, parseExtent);
  if (common.parentPartId === null) {
    addIssue(
      issues,
      `${path}.parentPartId`,
      'relationship',
      'A surface feature requires a parent part.'
    );
  }
  if (common.joint.kind !== 'fixed') {
    addIssue(
      issues,
      `${path}.joint`,
      'relationship',
      'A surface feature is fixed to its parent surface.'
    );
  }
  if (common.attachment !== null) {
    addIssue(
      issues,
      `${path}.attachment`,
      'relationship',
      'A surface feature has no geometry attachment.'
    );
  }
  const allowedGlyphs = motif === 'eye'
    ? EYE_GLYPHS
    : motif === 'nose'
      ? NOSE_GLYPHS
      : motif === 'mouth'
        ? MOUTH_GLYPHS
        : [];
  const glyphMatchesMotif =
    glyph === undefined ||
    glyph === null ||
    (allowedGlyphs as readonly string[]).includes(glyph);
  if (motif !== null && glyph !== undefined && !glyphMatchesMotif) {
    addIssue(
      issues,
      `${path}.glyph`,
      'relationship',
      motif === 'patch'
        ? 'A patch uses system-generated surface texture and does not accept a focal glyph.'
        : `glyph "${glyph}" is not valid for the ${motif} surface motif.`
    );
  }
  const resolvedGlyph = motif === 'eye'
    ? glyph ?? 'square'
    : motif === 'nose'
      ? glyph ?? 'dot'
      : motif === 'mouth'
        ? glyph ?? 'neutral'
        : undefined;
  if (size !== null && motif !== null && resolvedGlyph !== undefined) {
    const [width, height] = size;
    const invalidSize =
      (motif === 'eye' && (
        width > 6 || height > 5 ||
        width < 3 || height < 3
      )) ||
      (motif === 'nose' && (
        (resolvedGlyph === 'dot' && (width > 2 || height > 2)) ||
        (resolvedGlyph === 'snout' && (
          width < 2 || height < 2 || width > 6 || height > 4
        ))
      )) ||
      (motif === 'mouth' && (
        width > 6 || height > 4 ||
        (resolvedGlyph === 'neutral' && height > 2) ||
        (resolvedGlyph === 'fang' && (width < 2 || height < 2)) ||
        (resolvedGlyph === 'beak' && (width < 3 || height < 2))
      ));
    if (invalidSize) {
      addIssue(
        issues,
        `${path}.size`,
        'range',
        'Focal glyph size is outside its compact template range.'
      );
    }
  }
  if (
    motif === null ||
    face === null ||
    anchor === null ||
    size === null ||
    glyph === null ||
    !glyphMatchesMotif ||
    common.joint.kind !== 'fixed' ||
    common.attachment !== null
  ) {
    return { value: null, estimatedCells: 0 };
  }
  const value: FeaturePartSpec | null =
    common.parentPartId === null
      ? null
      : {
          ...common,
          joint: { kind: 'fixed' },
          attachment: null,
          kind: 'feature',
          motif,
          ...(glyph === undefined ? {} : { glyph }),
          face,
          anchor,
          size
        };
  return { value, estimatedCells: 0 };
};
