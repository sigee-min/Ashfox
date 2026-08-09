import type {
  IntentProgramFocal,
  IntentProgramIdleMotion,
  IntentProgramModule,
  IntentProgramModuleExtension,
  IntentProgramMouth,
  IntentProgramNose,
  IntentProgramPalette,
  IntentProgramRest,
  IntentProgramSurface,
  IntentProgramSurfaceExtension
} from './intentProgramTypes';

/** Partial syntax state; only normalization may construct the complete IR. */
export type RawIntentProgramFace =
  | { kind: 'none' }
  | {
      kind: 'full';
      on: string;
      eyes?: 'single' | 'paired';
      gaze?: 'center';
      nose?: IntentProgramNose;
      mouth?: IntentProgramMouth;
    };

export interface RawIntentProgramStyle {
  palette?: IntentProgramPalette;
}

export interface RawIntentProgram {
  asset?: string;
  track?: 'essential' | 'hero';
  domain?: 'organism' | 'constructed';
  frame?: 'north' | 'south' | 'east' | 'west';
  symmetry?: 'bilateral' | 'asymmetric';
  rest?: IntentProgramRest;
  body: IntentProgramModule[];
  surfaces: IntentProgramSurface[];
  face?: RawIntentProgramFace;
  focal?: IntentProgramFocal;
  motion?: { kind: 'idle'; mode: IntentProgramIdleMotion };
  style: RawIntentProgramStyle;
}

export const rootKeywords = new Set([
  'asset', 'track', 'domain', 'frame', 'symmetry', 'rest', 'body', 'surface',
  'face', 'eyes', 'nose', 'mouth', 'focal', 'motion', 'style'
]);

export const moduleKinds = new Set([
  'core', 'mass', 'chain', 'limb', 'wheel', 'radial'
]);

export const moduleDirections = new Set<IntentProgramModuleExtension>([
  'forward', 'rearward', 'up', 'down', 'left', 'right'
]);

export const pairedSurfaceDirections = new Set<IntentProgramSurfaceExtension>([
  'lateral', 'up', 'forward', 'rearward'
]);

export const singleSurfaceDirections = new Set<IntentProgramSurfaceExtension>([
  'left', 'right', 'up', 'forward', 'rearward'
]);

export const palettes = new Set<IntentProgramPalette>([
  'natural', 'ember', 'ocean', 'noir', 'metal', 'gold'
]);

export const identifierPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const normalizeIntentText = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');
