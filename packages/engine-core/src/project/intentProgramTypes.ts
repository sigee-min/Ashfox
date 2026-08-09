import type {
  ProjectForwardDirection,
  ProjectSemanticContract,
  ProjectSubjectDomain
} from '../model';

export type IntentProgramTrack = 'essential' | 'hero';
export type IntentProgramSymmetry = 'bilateral' | 'asymmetric';
export type IntentProgramRest =
  | { kind: 'feet'; on: string }
  | { kind: 'base'; on: string }
  | { kind: 'wheels'; on: string }
  | { kind: 'airborne' };
export type IntentProgramModuleKind =
  | 'core'
  | 'mass'
  | 'chain'
  | 'limb'
  | 'wheel'
  | 'radial';
/**
 * A named relationship in the canonical spatial frame. It deliberately has
 * no lattice coordinate or length; the compiler owns those details.
 */
export type IntentProgramModuleExtension =
  | 'forward'
  | 'rearward'
  | 'up'
  | 'down'
  | 'left'
  | 'right';
export type IntentProgramSurfaceRole = 'wing' | 'fin' | 'sail' | 'panel';
export type IntentProgramSurfaceExtension =
  | 'lateral'
  | 'left'
  | 'right'
  | 'up'
  | 'forward'
  | 'rearward';
export type IntentProgramMouth = 'absent' | 'neutral' | 'beak' | 'fang';
export type IntentProgramNose = 'absent' | 'present';
export type IntentProgramIdleMotion = 'still' | 'breathe' | 'scan';
/** The closed palette vocabulary accepted by the canonical language. */
export const INTENT_PROGRAM_PALETTES = [
  'natural', 'ember', 'ocean', 'noir', 'metal', 'gold'
] as const;
export type IntentProgramPalette = (typeof INTENT_PROGRAM_PALETTES)[number];

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

export interface IntentProgramCoreModule {
  id: string;
  kind: 'core';
  /** Named compiler-facing relationships, never lattice coordinates. */
  from?: undefined;
  extension?: undefined;
  /**
   * The source spelling is `pair`; `paired` is the normalized semantic shape
   * used by the existing project semantic contract.
   */
  configuration?: undefined;
  modifiers: readonly [];
}

/** A non-core module always owns one named host and exterior relation. */
export interface IntentProgramAttachedModule {
  id: string;
  kind: Exclude<IntentProgramModuleKind, 'core'>;
  from: string;
  extension: IntentProgramModuleExtension;
  configuration?: 'paired';
  modifiers: readonly [];
}

export type IntentProgramModule =
  | IntentProgramCoreModule
  | IntentProgramAttachedModule;

export interface IntentProgramSurface {
  id: string;
  role: IntentProgramSurfaceRole;
  /** Source spelling is `pair`; this is the normalized semantic shape. */
  configuration: 'single' | 'paired';
  from: string;
  extension: IntentProgramSurfaceExtension;
}

export interface IntentProgramAbsentFace {
  kind: 'none';
  on?: undefined;
  eyes?: undefined;
  gaze?: undefined;
  nose?: undefined;
  mouth?: undefined;
}

/** Parser invariants require `on` whenever kind is `full`. */
export interface IntentProgramFullFace {
  kind: 'full';
  on: string;
  /** A normalized full face is complete; partial declarations are parser-only. */
  eyes: 'single' | 'paired';
  gaze: 'center';
  nose: IntentProgramNose;
  mouth: IntentProgramMouth;
}

export type IntentProgramFace = IntentProgramAbsentFace | IntentProgramFullFace;

export interface IntentProgramFocal {
  id: string;
  on: string;
}

export interface IntentProgramMotion {
  kind: 'idle';
  mode: IntentProgramIdleMotion;
}

export interface IntentProgramStyle {
  palette: IntentProgramPalette;
}

/** A lossless-enough parse tree intended solely for diagnostics and source maps. */
export interface IntentProgramAstField {
  /** Canonical IR path populated by this token. */
  path: string;
  value: string;
  span: IntentProgramSpan;
}

export interface IntentProgramAstStatement {
  keyword: string;
  values: readonly string[];
  span: IntentProgramSpan;
  /** Field-level token ownership, never part of canonical IR serialization. */
  fields: readonly IntentProgramAstField[];
}

export interface IntentProgramAst {
  statements: readonly IntentProgramAstStatement[];
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
  focal?: IntentProgramFocal;
  motion: IntentProgramMotion;
  style: IntentProgramStyle;
  /** Existing project semantic authority derived mechanically from this IR. */
  semanticContract: ProjectSemanticContract;
}

/** Source spans are keyed by canonical IR paths, not generated part IDs. */
export type IntentProgramSourceMap = Readonly<Record<string, IntentProgramSpan>>;

/**
 * Finds the most-specific source declaration for a canonical IR path.
 *
 * Compiler diagnostics routinely refer to generated subpaths such as
 * `body.head.port.front`; the program source only owns `body.head.from` or
 * `body.head`. Walking path segments keeps those diagnostics attached to the
 * declaration that caused them instead of falling back to line 1.
 */
export const resolveIntentProgramSourceSpan = (
  sourceMap: IntentProgramSourceMap,
  path: string
): IntentProgramSpan | undefined => {
  let candidate = path;
  while (candidate.length > 0) {
    const exact = sourceMap[candidate];
    if (exact) return exact;
    const separator = candidate.lastIndexOf('.');
    if (separator < 0) return undefined;
    candidate = candidate.slice(0, separator);
  }
  return undefined;
};

export interface IntentProgramParseResult {
  source: string;
  ast: IntentProgramAst;
  ir: IntentProgramIr | null;
  canonical: string | null;
  hash: string | null;
  diagnostics: readonly IntentProgramDiagnostic[];
  /** Canonical IR paths point to the source declaration that produced them. */
  sourceMap: IntentProgramSourceMap;
}
