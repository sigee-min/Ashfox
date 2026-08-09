import type {
  CubeFaceDirection,
  ModelGeometryPrimitive,
  ProjectSubjectDomain,
  Vec3
} from '../../model';
import type {
  ProjectAppearanceContrast,
  ProjectAppearanceDensity,
  ProjectAppearanceFlow,
  ProjectAppearanceMotif,
  ProjectAppearancePlacement,
  ProjectAppearanceRegion,
  ProjectAppearanceScale,
  ProjectAppearanceTarget,
  ProjectAppearanceTone
} from '../../project/appearance/contract';

export const SURFACE_APPEARANCE_VERSION = 1 as const;
export const SURFACE_SYNTHESIS_VERSION = 1 as const;

export type SurfaceAppearanceDomain = ProjectSubjectDomain | 'neutral';

export type SurfaceDecorationProfile =
  | 'body'
  | 'articulated'
  | 'support'
  | 'rotary'
  | 'focal'
  | 'accent'
  | 'wing'
  | 'fin'
  | 'sail'
  | 'panel';

export type SurfaceFaceAspect =
  | 'dorsal'
  | 'ventral'
  | 'anterior'
  | 'posterior'
  | 'flank';

export type SurfaceAppearanceTonePolicy = 'regular' | 'focal';

export type SurfaceTextureKind =
  | 'quiet'
  | 'mottle'
  | 'grain'
  | 'brushed'
  | 'weathered';
export type SurfaceTextureScale = 'fine' | 'medium' | 'broad';
export type SurfaceTextureDensity = 'sparse' | 'balanced' | 'rich';
export type SurfaceTextureContrast = 'subtle' | 'medium' | 'bold';

export interface SurfaceTextureIntentV1 {
  readonly kind: SurfaceTextureKind;
  readonly scale: SurfaceTextureScale;
  readonly density: SurfaceTextureDensity;
  /** Palette projection only; never an input to the role mask or seed. */
  readonly contrast: SurfaceTextureContrast;
}

/**
 * Seed authority is typed so a future source-level explicit seed does not
 * need to overload IDs or parse naming conventions.
 */
export type SurfaceAppearanceSeed =
  | { readonly kind: 'auto'; readonly semanticKey: string }
  | { readonly kind: 'explicit'; readonly value: string };

export interface SurfaceAppearanceAxisRange {
  readonly minimum: number;
  readonly maximum: number;
}

export interface SurfaceAppearanceProjectFrame {
  readonly forward: Vec3;
  readonly left: Vec3;
  readonly up: Vec3;
  readonly lateralRange: SurfaceAppearanceAxisRange;
  readonly upRange: SurfaceAppearanceAxisRange;
  readonly forwardRange: SurfaceAppearanceAxisRange;
}

export interface SurfaceAppearanceProtectedRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SurfaceAppearanceReflection {
  readonly axis: 'x' | 'z';
  /** Twice the reflection-plane coordinate in the synthesis coordinate unit. */
  readonly planeTwice: number;
  /** World-axis sign pointing toward semantic left. */
  readonly leftSign: -1 | 1;
}

/**
 * One compiler-resolved semantic mark for one face. Its frame belongs to the
 * complete explicitly bound target, rather than to an atlas rectangle or an
 * individual cuboid split.
 */
export interface SurfaceAppearanceMarkingPlan {
  readonly id: string;
  readonly target: ProjectAppearanceTarget;
  readonly region: ProjectAppearanceRegion;
  readonly placement: ProjectAppearancePlacement;
  readonly motif: ProjectAppearanceMotif;
  readonly tone: ProjectAppearanceTone;
  readonly flow?: ProjectAppearanceFlow;
  readonly variant?: string;
  readonly scale: ProjectAppearanceScale;
  readonly density: ProjectAppearanceDensity;
  /** RGB distance only; excluded from maskSeed and analytic mask selection. */
  readonly contrast: ProjectAppearanceContrast;
  /** Compiler palette material. Null only at a non-canonical compatibility boundary. */
  readonly accentColor: string | null;
  /** Stable fixed-point stream derived without tone, contrast, or palette. */
  readonly maskSeed: number;
  readonly frame: SurfaceAppearanceProjectFrame;
  readonly rootPoints: readonly Vec3[];
  /** Global or explicitly paired semantic reflection; never inferred from IDs. */
  readonly reflection: SurfaceAppearanceReflection | null;
}

/** Closed semantic appearance IR consumed by object-space synthesis. */
export interface SurfaceAppearanceV1 {
  readonly version: typeof SURFACE_APPEARANCE_VERSION;
  readonly seed: SurfaceAppearanceSeed;
  /** Opaque identity only; semantics are never inferred from its spelling. */
  readonly semanticOwnerKey: string;
  /** Present only when multiple emitted plates form one authoring membrane. */
  readonly semanticRegion?: 'membrane';
  readonly domain: SurfaceAppearanceDomain;
  readonly texture: SurfaceTextureIntentV1;
  readonly decoration: SurfaceDecorationProfile;
  readonly geometry: ModelGeometryPrimitive;
  readonly faceDirection: CubeFaceDirection;
  readonly faceAspect: SurfaceFaceAspect;
  readonly plane: number;
  readonly attachmentPoints: readonly Vec3[];
  readonly protectedRegions: readonly SurfaceAppearanceProtectedRegion[];
  /** Fixed-class, stable-ID ordered semantic marks applicable to this face. */
  readonly markings?: readonly SurfaceAppearanceMarkingPlan[];
  readonly frame: SurfaceAppearanceProjectFrame;
  readonly tonePolicy: SurfaceAppearanceTonePolicy;
}
