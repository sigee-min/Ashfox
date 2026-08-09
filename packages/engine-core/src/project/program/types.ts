import type {
  ProjectAppearanceMarking,
  ProjectAppearanceSeed,
  ProjectAppearanceTexture,
  ProjectAppearanceV1
} from '../appearance/contract';
import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from './language';

type Language = typeof INTENT_PROGRAM_LANGUAGE_SPECIFICATION;

export type IntentProgramRootBlock = Language['rootBlocks'][number];
export type IntentProgramTrack = Language['metadata']['tracks'][number];
export type IntentProgramDomain = Language['metadata']['domains'][number];
export type IntentProgramForwardDirection =
  Language['model']['forwardDirections'][number];
export type IntentProgramSymmetry = Language['model']['symmetries'][number];
export type IntentProgramSupportKind = Language['supportKinds'][number];
export type IntentProgramModuleKind = Language['model']['moduleKinds'][number];
export type IntentProgramCardinality =
  Language['model']['cardinalities'][number];
export type IntentProgramAttachmentAnchor = Language['anchors'][number];
export type IntentProgramGrowthDirection = Language['growth'][number];
export type IntentProgramAttachmentLane = Language['lanes'][number];
export type IntentProgramSurfaceRole = Language['model']['surfaceRoles'][number];
export type IntentProgramSurfaceAxis =
  Language['surfaceShapes']['axis'][number];
export type IntentProgramSurfaceSpan =
  Language['surfaceShapes']['span'][number];
export type IntentProgramSurfaceChord =
  Language['surfaceShapes']['chord'][number];
export type IntentProgramSurfaceTip =
  Language['surfaceShapes']['tip'][number];
export type IntentProgramSurfaceOffset =
  Language['surfaceShapes']['offset'][number];
export type IntentProgramSurfaceEdge =
  Language['surfaceShapes']['edge'][number];
export type IntentProgramMouth = Language['model']['mouthModes'][number];
export type IntentProgramNose = Language['model']['noseModes'][number];
export type IntentProgramEyeConfiguration =
  Language['model']['eyeConfigurations'][number];
export type IntentProgramGaze = Language['model']['gazeModes'][number];
export type IntentProgramIdleMode = Language['animation']['idleModes'][number];
export const INTENT_PROGRAM_PALETTES =
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION.appearance.palettes;
export type IntentProgramPalette = typeof INTENT_PROGRAM_PALETTES[number];

export interface IntentProgramPosition {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

export interface IntentProgramSpan {
  readonly start: IntentProgramPosition;
  readonly end: IntentProgramPosition;
}

export interface IntentProgramDiagnostic {
  readonly severity: 'error' | 'warning';
  readonly code: string;
  readonly message: string;
  readonly span: IntentProgramSpan;
}

/** `none` projects to grounding `none`; reference-justified free intent is separate. */
export type IntentProgramSupport =
  | { readonly kind: 'none'; readonly contacts: readonly [] }
  | {
      readonly kind: 'feet' | 'wheels';
      readonly contacts: readonly [string, ...string[]];
    }
  | { readonly kind: 'base'; readonly contacts: readonly [string] };

export interface IntentProgramCoreModule {
  readonly id: string;
  readonly kind: 'core';
  readonly cardinality: 'single';
}

export interface IntentProgramAttachedModule {
  readonly id: string;
  readonly kind: Exclude<IntentProgramModuleKind, 'core'>;
  readonly cardinality: IntentProgramCardinality;
  readonly parent: string;
  readonly anchor: IntentProgramAttachmentAnchor;
  readonly growth: IntentProgramGrowthDirection;
  readonly lane: IntentProgramAttachmentLane;
}

export type IntentProgramModule =
  | IntentProgramCoreModule
  | IntentProgramAttachedModule;

export interface IntentProgramSurfaceShape {
  readonly axis: IntentProgramSurfaceAxis;
  readonly span: IntentProgramSurfaceSpan;
  readonly chord: IntentProgramSurfaceChord;
  readonly tip: IntentProgramSurfaceTip;
  readonly offset: IntentProgramSurfaceOffset;
  readonly edge: IntentProgramSurfaceEdge;
}

export interface IntentProgramSurfaceDeclaration {
  readonly id: string;
  readonly role: IntentProgramSurfaceRole;
  readonly cardinality: IntentProgramCardinality;
  readonly parent: string;
  readonly anchor: IntentProgramAttachmentAnchor;
  readonly growth: IntentProgramGrowthDirection;
  readonly lane: IntentProgramAttachmentLane;
}

export interface IntentProgramSurface extends IntentProgramSurfaceDeclaration {
  readonly shape?: IntentProgramSurfaceShape;
}

export interface IntentProgramSurfaceShapeDeclaration {
  readonly surfaceId: string;
  readonly shape: IntentProgramSurfaceShape;
}

export interface IntentProgramAbsentFace {
  readonly kind: 'none';
}

export interface IntentProgramFullFace {
  readonly kind: 'full';
  readonly parent: string;
  readonly eyes: IntentProgramEyeConfiguration;
  readonly gaze: IntentProgramGaze;
  readonly nose: IntentProgramNose;
  readonly mouth: IntentProgramMouth;
}

export type IntentProgramFace = IntentProgramAbsentFace | IntentProgramFullFace;

export interface IntentProgramFocal {
  readonly id: string;
  readonly parent: string;
}

export interface IntentProgramIdleAnimation {
  readonly mode: IntentProgramIdleMode;
  readonly target?: string;
}

export interface IntentProgramAnimation {
  readonly idle: IntentProgramIdleAnimation;
}

export interface IntentProgramAppearance extends ProjectAppearanceV1 {
  readonly palette: IntentProgramPalette;
}

export interface IntentProgramAuthorityPresence {
  readonly metadata: boolean;
  readonly model: boolean;
  readonly animation: boolean;
  readonly appearance: boolean;
}

export interface IntentProgramSemanticMetadata {
  readonly name?: string;
  readonly track?: IntentProgramTrack;
  readonly domain?: IntentProgramDomain;
}

/** Constraint input can retain an incomplete face while reporting all leaves. */
export type IntentProgramSemanticFace =
  | IntentProgramAbsentFace
  | {
      readonly kind: 'full';
      readonly parent: string;
      readonly eyes?: IntentProgramEyeConfiguration;
      readonly gaze?: IntentProgramGaze;
      readonly nose?: IntentProgramNose;
      readonly mouth?: IntentProgramMouth;
    };

export interface IntentProgramSemanticModel {
  readonly orientation?: { readonly forward: IntentProgramForwardDirection };
  readonly symmetry?: IntentProgramSymmetry;
  readonly support?: {
    readonly kind: IntentProgramSupportKind;
    readonly contacts: readonly string[];
  };
  readonly body: readonly IntentProgramModule[];
  readonly surfaces: readonly IntentProgramSurfaceDeclaration[];
  readonly surfaceShapes: readonly IntentProgramSurfaceShapeDeclaration[];
  readonly face?: IntentProgramSemanticFace;
  readonly focal?: IntentProgramFocal;
}

export interface IntentProgramSemanticAnimation {
  readonly idle?: IntentProgramIdleAnimation;
}

export interface IntentProgramSemanticAppearance {
  readonly palette?: IntentProgramPalette;
  readonly texture?: ProjectAppearanceTexture;
  readonly seed?: ProjectAppearanceSeed;
  readonly markings: readonly ProjectAppearanceMarking[];
}

/**
 * Readonly meaning recovered from the four source authority blocks. It may be
 * incomplete; the constraint resolver is the only constructor of canonical IR.
 */
export interface IntentProgramSemanticAst {
  readonly authorities: IntentProgramAuthorityPresence;
  readonly metadata: IntentProgramSemanticMetadata;
  readonly model: IntentProgramSemanticModel;
  readonly animation: IntentProgramSemanticAnimation;
  readonly appearance: IntentProgramSemanticAppearance;
}

/** Token-owned syntax retained for diagnostics, never canonical serialization. */
export interface IntentProgramAstField {
  readonly path: string;
  readonly value: string;
  readonly span: IntentProgramSpan;
}

export interface IntentProgramAstStatement {
  readonly keyword: string;
  readonly values: readonly string[];
  readonly span: IntentProgramSpan;
  readonly fields: readonly IntentProgramAstField[];
}

export interface IntentProgramAst {
  readonly statements: readonly IntentProgramAstStatement[];
}

/** Coordinate-free, complete, canonical compiler authority. */
export interface IntentProgramIr {
  readonly name: string;
  readonly track: IntentProgramTrack;
  readonly domain: IntentProgramDomain;
  readonly orientation: { readonly forward: IntentProgramForwardDirection };
  readonly symmetry: IntentProgramSymmetry;
  readonly support: IntentProgramSupport;
  readonly body: readonly IntentProgramModule[];
  readonly surfaces: readonly IntentProgramSurface[];
  readonly face: IntentProgramFace;
  readonly focal?: IntentProgramFocal;
  readonly animation: IntentProgramAnimation;
  readonly appearance: IntentProgramAppearance;
}

/** Source spans are keyed by canonical IR paths, never generated part IDs. */
export type IntentProgramSourceMap = Readonly<Record<string, IntentProgramSpan>>;

const authorityPathFor = (path: string): IntentProgramRootBlock | undefined => {
  const root = path.split('.')[0] ?? '';
  if (root === 'name' || root === 'track' || root === 'domain' || root === 'metadata') {
    return 'metadata';
  }
  if (
    root === 'orientation' || root === 'symmetry' || root === 'support' ||
    root === 'body' || root === 'surfaces' || root === 'face' ||
    root === 'focal' || root === 'model'
  ) return 'model';
  if (root === 'animation') return 'animation';
  if (root === 'appearance') return 'appearance';
  return undefined;
};

/** Finds the most-specific source declaration for a canonical IR path. */
export const resolveIntentProgramSourceSpan = (
  sourceMap: IntentProgramSourceMap,
  path: string
): IntentProgramSpan | undefined => {
  let candidate = path;
  while (candidate.length > 0) {
    const exact = sourceMap[candidate];
    if (exact) return exact;
    const separator = candidate.lastIndexOf('.');
    if (separator < 0) break;
    candidate = candidate.slice(0, separator);
  }
  const authority = authorityPathFor(path);
  return authority ? sourceMap[authority] : undefined;
};

export interface IntentProgramParseResult {
  readonly source: string;
  readonly ast: IntentProgramAst;
  readonly semanticAst: IntentProgramSemanticAst;
  readonly ir: IntentProgramIr | null;
  readonly canonical: string | null;
  readonly hash: string | null;
  readonly diagnostics: readonly IntentProgramDiagnostic[];
  readonly sourceMap: IntentProgramSourceMap;
}
