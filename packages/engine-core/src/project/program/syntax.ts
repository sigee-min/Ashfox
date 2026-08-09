import type {
  ProjectAppearanceMarking,
  ProjectAppearanceSeed,
  ProjectAppearanceTexture
} from '../appearance/contract';
import type { IntentProgramToken } from './lexer';
import {
  INTENT_PROGRAM_IDENTIFIER_PATTERN
} from './language';
import type {
  IntentProgramDomain,
  IntentProgramEyeConfiguration,
  IntentProgramFocal,
  IntentProgramForwardDirection,
  IntentProgramIdleAnimation,
  IntentProgramModule,
  IntentProgramMouth,
  IntentProgramNose,
  IntentProgramPalette,
  IntentProgramSemanticAst,
  IntentProgramSurfaceDeclaration,
  IntentProgramSurfaceShapeDeclaration,
  IntentProgramSupportKind,
  IntentProgramSymmetry,
  IntentProgramTrack
} from './types';

export type IntentProgramWordToken<TValue extends string = string> =
  IntentProgramToken & { readonly kind: 'word'; readonly value: TValue };

export const isIntentProgramWordToken = (
  token: IntentProgramToken | undefined
): token is IntentProgramWordToken => token?.kind === 'word';

export const isIntentProgramWord = <TValue extends string>(
  token: IntentProgramToken | undefined,
  value: TValue
): token is IntentProgramWordToken<TValue> =>
  token?.kind === 'word' && token.value === value;

export const isIntentProgramVocabularyWord = <TValue extends string>(
  token: IntentProgramToken | undefined,
  values: readonly TValue[]
): token is IntentProgramWordToken<TValue> =>
  token?.kind === 'word' && values.some((candidate) => candidate === token.value);

export interface RawIntentProgramFace {
  kind?: 'none' | 'full';
  parent?: string;
  eyes?: IntentProgramEyeConfiguration;
  gaze?: 'center';
  nose?: IntentProgramNose;
  mouth?: IntentProgramMouth;
}

export interface RawIntentProgramMetadata {
  name?: string;
  track?: IntentProgramTrack;
  domain?: IntentProgramDomain;
}

export interface RawIntentProgramModel {
  orientation?: { forward: IntentProgramForwardDirection };
  symmetry?: IntentProgramSymmetry;
  support?: { kind: IntentProgramSupportKind; contacts: string[] };
  body: IntentProgramModule[];
  surfaces: IntentProgramSurfaceDeclaration[];
  surfaceShapes: IntentProgramSurfaceShapeDeclaration[];
  face?: RawIntentProgramFace;
  focal?: IntentProgramFocal;
}

export interface RawIntentProgramAnimation {
  idle?: IntentProgramIdleAnimation;
}

export interface RawIntentProgramAppearance {
  palette?: IntentProgramPalette;
  texture?: ProjectAppearanceTexture;
  seed?: ProjectAppearanceSeed;
  markings: ProjectAppearanceMarking[];
}

/** Mutable owner-local builder; never passed directly to the compiler. */
export interface RawIntentProgram {
  authorities: {
    metadata: boolean;
    model: boolean;
    animation: boolean;
    appearance: boolean;
  };
  metadata: RawIntentProgramMetadata;
  model: RawIntentProgramModel;
  animation: RawIntentProgramAnimation;
  appearance: RawIntentProgramAppearance;
}

export const createRawIntentProgram = (): RawIntentProgram => ({
  authorities: {
    metadata: false,
    model: false,
    animation: false,
    appearance: false
  },
  metadata: {},
  model: { body: [], surfaces: [], surfaceShapes: [] },
  animation: {},
  appearance: { markings: [] }
});

/** Readonly semantic view consumed by the constraint boundary. */
export const toIntentProgramSemanticAst = (
  raw: RawIntentProgram
): IntentProgramSemanticAst => {
  const draft = raw.model.face;
  const { face: _draftFace, ...model } = raw.model;
  const face = draft?.kind === 'none'
    ? { kind: 'none' as const }
    : draft?.kind === 'full' && draft.parent
      ? {
          kind: 'full' as const,
          parent: draft.parent,
          ...(draft.eyes ? { eyes: draft.eyes } : {}),
          ...(draft.gaze ? { gaze: draft.gaze } : {}),
          ...(draft.nose ? { nose: draft.nose } : {}),
          ...(draft.mouth ? { mouth: draft.mouth } : {})
        }
      : undefined;
  return {
    authorities: raw.authorities,
    metadata: raw.metadata,
    model: {
      ...model,
      ...(face ? { face } : {})
    },
    animation: raw.animation,
    appearance: raw.appearance
  };
};

export const identifierPattern = INTENT_PROGRAM_IDENTIFIER_PATTERN;
