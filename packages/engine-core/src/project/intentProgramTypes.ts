import type {
  ProjectForwardDirection,
  ProjectSemanticContract,
  ProjectSubjectDomain
} from '../model';

export type IntentProgramTrack = 'essential' | 'hero';
export type IntentProgramSymmetry = 'bilateral' | 'asymmetric';
export type IntentProgramRest =
  | { kind: 'feet' }
  | { kind: 'base' }
  | { kind: 'airborne' };
export type IntentProgramModuleKind =
  | 'core'
  | 'mass'
  | 'chain'
  | 'limb'
  | 'wheel'
  | 'radial';
export type IntentProgramSurfaceRole = 'wing' | 'fin' | 'sail' | 'panel';
export type IntentProgramSurfaceExtension =
  | 'lateral'
  | 'up'
  | 'forward'
  | 'rearward';
export type IntentProgramMouth = 'absent' | 'neutral' | 'beak' | 'fang';
export type IntentProgramNose = 'absent' | 'present';

export interface IntentProgramPosition {
  offset: number;
  line: number;
  column: number;
}

export interface IntentProgramSpan {
  start: IntentProgramPosition;
  end: IntentProgramPosition;
}

export interface IntentProgramDiagnostic {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  span: IntentProgramSpan;
}

export interface IntentProgramModule {
  id: string;
  kind: IntentProgramModuleKind;
  /** Named compiler-facing relationships, never lattice coordinates. */
  from?: string;
  configuration?: 'single' | 'paired';
  modifiers: readonly string[];
}

export interface IntentProgramSurface {
  id: string;
  role: IntentProgramSurfaceRole;
  configuration: 'single' | 'paired';
  from: string;
  extension: IntentProgramSurfaceExtension;
}

export interface IntentProgramFace {
  kind: 'none' | 'full';
  eyes?: 'single' | 'paired';
  gaze?: 'center';
  nose?: IntentProgramNose;
  mouth?: IntentProgramMouth;
}

export interface IntentProgramStyle {
  palette?: string;
}

/** A lossless-enough parse tree intended solely for diagnostics and source maps. */
export interface IntentProgramAst {
  statements: readonly {
    keyword: string;
    values: readonly string[];
    span: IntentProgramSpan;
  }[];
}

/**
 * The normalized, coordinate-free semantic program. This is the only input a
 * future model compiler should need; mesh/parts/profiles remain derived.
 */
export interface IntentProgramIr {
  asset: string;
  track: IntentProgramTrack;
  domain: ProjectSubjectDomain;
  frame: { facing: ProjectForwardDirection };
  symmetry: IntentProgramSymmetry;
  rest: IntentProgramRest;
  body: readonly IntentProgramModule[];
  surfaces: readonly IntentProgramSurface[];
  face: IntentProgramFace;
  style: IntentProgramStyle;
  /** Existing project semantic authority derived mechanically from this IR. */
  semanticContract: ProjectSemanticContract;
}

export interface IntentProgramParseResult {
  source: string;
  ast: IntentProgramAst;
  ir: IntentProgramIr | null;
  canonical: string | null;
  hash: string | null;
  diagnostics: readonly IntentProgramDiagnostic[];
  /** Canonical IR paths point to the source declaration that produced them. */
  sourceMap: Readonly<Record<string, IntentProgramSpan>>;
}
