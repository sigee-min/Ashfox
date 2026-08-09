import {
  authoringFaceComponentSlotIds,
  type AuthoringFaceContract
} from '../../../authoring/contract';
import type { ProjectAppearanceBinding } from '../../../project/appearance/contract';
import { compareStableText } from '../../../stableOrder';
import type {
  IntentProgramDiagnostic,
  IntentProgramIr,
  IntentProgramSpan
} from '../../../project/program/types';
import { intentProgramDiagnostic } from '../diagnostic';
import type { IntentProgramLoweringContext } from '../lower/context';
import { intentProgramAccentColor } from '../plan/recipe';

export type IntentProgramAppearanceBindingResult =
  | {
      readonly ok: true;
      readonly bindings: readonly ProjectAppearanceBinding[];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly IntentProgramDiagnostic[];
    };

const uniqueSorted = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort(compareStableText);

const slotParts = (
  context: IntentProgramLoweringContext,
  slotIds: readonly string[]
): readonly string[] => uniqueSorted(slotIds.flatMap((slotId) =>
  context.slot(slotId)?.partIds ?? []
));

const bodyParts = (
  context: IntentProgramLoweringContext,
  program: IntentProgramIr,
  moduleId: string
): readonly string[] => {
  const module = program.body.find((candidate) => candidate.id === moduleId);
  if (!module) return [];
  if (module.kind === 'limb') {
    return slotParts(
      context,
      context.limbPair(moduleId)?.members.map((member) => member.slotId) ?? []
    );
  }
  if (module.kind === 'wheel') {
    return slotParts(
      context,
      context.wheelPair(moduleId)?.members.map((member) => member.slotId) ?? []
    );
  }
  const host = context.host(moduleId);
  return host ? [host.partId] : [];
};

const surfaceParts = (
  context: IntentProgramLoweringContext,
  surfaceId: string
): readonly string[] => uniqueSorted(context.slots.flatMap((slot) =>
  slot.span.kind === 'supported-surface' &&
  slot.span.obligationId === surfaceId
    ? slot.partIds
    : []
));

const markingParts = (
  context: IntentProgramLoweringContext,
  program: IntentProgramIr,
  face: AuthoringFaceContract | null,
  marking: IntentProgramIr['appearance']['markings'][number]
): readonly string[] => {
  switch (marking.target.kind) {
    case 'body': return bodyParts(context, program, marking.target.id);
    case 'surface': return surfaceParts(context, marking.target.id);
    case 'face': return face ? slotParts(context, [
      face.hostSlotId,
      ...face.components.flatMap(authoringFaceComponentSlotIds)
    ]) : [];
    case 'focal': return slotParts(context, [`slot.focal.${marking.target.id}`]);
  }
};

/** Resolves semantic source targets once, before raster synthesis sees them. */
export const resolveIntentProgramAppearanceBindings = (
  context: IntentProgramLoweringContext,
  program: IntentProgramIr,
  face: AuthoringFaceContract | null,
  sourceMap: Readonly<Record<string, IntentProgramSpan>>
): IntentProgramAppearanceBindingResult => {
  const diagnostics: IntentProgramDiagnostic[] = [];
  const bindings = program.appearance.markings.map((marking) => {
    const partIds = markingParts(context, program, face, marking);
    if (partIds.length === 0) diagnostics.push(intentProgramDiagnostic(
      sourceMap,
      `appearance.markings.${marking.id}.target`,
      'intent-program.appearance-target-unrealized',
      `Appearance marking "${marking.id}" has no generated target surface.`
    ));
    return Object.freeze({
      markingId: marking.id,
      partIds: Object.freeze([...partIds]),
      faceScope: marking.target.kind === 'face'
        ? 'anterior' as const
        : 'full' as const,
      ...(marking.tone === 'accent'
        ? { accentColor: intentProgramAccentColor(program.appearance.palette) }
        : {})
    });
  });
  return diagnostics.length > 0
    ? {
        ok: false,
        diagnostics: Object.freeze([...diagnostics].sort((left, right) =>
          left.span.start.offset - right.span.start.offset ||
          left.span.end.offset - right.span.end.offset ||
          compareStableText(left.code, right.code)
        ))
      }
    : {
        ok: true,
        bindings: Object.freeze([...bindings].sort((left, right) =>
          compareStableText(left.markingId, right.markingId)
        ))
      };
};
