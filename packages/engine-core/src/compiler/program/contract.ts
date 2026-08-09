import type {
  AuthoringSelectionInput
} from '../../authoring/contract';
import type {
  ConstrainedModelRecipe,
  ProjectIntent
} from '../../model';
import type {
  IntentProgramDiagnostic,
  IntentProgramAttachmentAnchor,
  IntentProgramAttachmentLane,
  IntentProgramGrowthDirection,
  IntentProgramIr,
  IntentProgramModule,
  IntentProgramSurface,
  IntentProgramSurfaceAxis,
  IntentProgramSurfaceChord,
  IntentProgramSurfaceEdge,
  IntentProgramSurfaceOffset,
  IntentProgramSurfaceSpan,
  IntentProgramSurfaceTip,
  IntentProgramSpan
} from '../../project/program/types';

export type IntentProgramGraphNodeKind =
  | 'core'
  | 'mass'
  | 'chain'
  | 'limb'
  | 'wheel'
  | 'radial'
  | 'surface'
  | 'focal'
  | 'face-host'
  | 'face-feature';

/**
 * Coordinate-free compiler graph. IDs are compiler-owned and stable for an
 * unchanged normalized program; consumers must not edit them directly.
 */
export interface IntentProgramGraphNode {
  readonly id: string;
  readonly kind: IntentProgramGraphNodeKind;
  readonly sourcePath: string;
  readonly parentId: string | null;
  readonly cardinality: 'single' | 'paired';
  readonly children: readonly string[];
}

export interface IntentProgramStructuralGraph {
  readonly rootId: string;
  readonly nodes: readonly IntentProgramGraphNode[];
}

/**
 * Compiler-owned counterpart relationship for geometry that is lowered once
 * and reflected across the semantic bilateral plane.  It is deliberately
 * separate from slots: attachment resolution is a geometry operation and
 * must derive the second member from the resolved first member, rather than
 * run two unrelated lattice tie-breaks.
 */
export interface IntentProgramAttachmentReflection {
  readonly sourcePartId: string;
  readonly reflectedPartId: string;
}

/**
 * Immutable, coordinate-free boundary between semantic validation and
 * geometry lowering. Geometry emitters may realize this plan, but must not
 * resolve hosts, choose ports, or infer support/motion ownership themselves.
 */
export interface IntentProgramPlannedAttachment {
  readonly moduleId: string;
  readonly hostModuleId: string;
  readonly anchor: IntentProgramAttachmentAnchor;
  readonly growth: IntentProgramGrowthDirection;
  readonly lane: IntentProgramAttachmentLane;
  readonly portKey: string;
  readonly sourcePath: string;
}

/** One integer station in a compiler-owned custom surface planform. */
export interface IntentProgramSurfaceStation {
  readonly along: number;
  readonly center: number;
  readonly halfChord: number;
}

export interface IntentProgramSurfacePoint {
  readonly along: number;
  readonly cross: number;
}

/** One convex plate region in the immutable custom-surface topology. */
export interface IntentProgramSurfaceMembrane {
  readonly id: string;
  readonly outline: readonly IntentProgramSurfacePoint[];
  readonly attachment: IntentProgramSurfacePoint;
  readonly parentId?: string;
}

/**
 * Coordinate-free integer silhouette resolved before geometry emission.
 * Role is intentionally absent: custom geometry is owned only by shape.
 */
export interface IntentProgramResolvedSurfaceShape {
  readonly axis: IntentProgramSurfaceAxis;
  readonly span: IntentProgramSurfaceSpan;
  readonly chord: IntentProgramSurfaceChord;
  readonly tip: IntentProgramSurfaceTip;
  readonly offset: IntentProgramSurfaceOffset;
  readonly edge: IntentProgramSurfaceEdge;
  readonly rootLength: number;
  readonly spanLength: number;
  readonly stations: readonly IntentProgramSurfaceStation[];
  readonly membranes: readonly IntentProgramSurfaceMembrane[];
  readonly fork?: {
    readonly notchAlong: number;
    readonly notchHalfChord: number;
  };
}

/** Immutable surface boundary consumed by presentation geometry lowering. */
export interface IntentProgramPlannedSurface {
  readonly id: string;
  readonly role: IntentProgramSurface['role'];
  readonly cardinality: IntentProgramSurface['cardinality'];
  readonly hostModuleId: string;
  readonly anchor: IntentProgramSurface['anchor'];
  readonly growth: IntentProgramSurface['growth'];
  readonly lane: IntentProgramSurface['lane'];
  readonly portKey: string;
  readonly portOffset: -2 | 0 | 2;
  readonly sourcePath: string;
  /** Omitted when the role-owned default planform is requested. */
  readonly shape?: IntentProgramResolvedSurfaceShape;
}

export type IntentProgramPlannedSupport =
  | { readonly kind: 'none'; readonly moduleIds: readonly [] }
  | { readonly kind: 'base'; readonly moduleIds: readonly [string] }
  | {
      readonly kind: 'feet' | 'wheels';
      readonly moduleIds: readonly string[];
    };

export type IntentProgramPlannedPresentation =
  | { readonly kind: 'none' }
  | { readonly kind: 'face'; readonly hostModuleId: string }
  | {
      readonly kind: 'focal';
      readonly focalId: string;
      readonly hostModuleId: string;
    };

export interface IntentProgramPlannedMotion {
  readonly mode: IntentProgramIr['animation']['idle']['mode'];
  readonly targetModuleId: string;
}

export interface IntentProgramCompilationPlan {
  readonly rootModuleId: string;
  /** Parent-before-child order; never declaration-order or ID-order geometry. */
  readonly modules: readonly IntentProgramModule[];
  readonly attachments: readonly IntentProgramPlannedAttachment[];
  readonly surfaces: readonly IntentProgramPlannedSurface[];
  readonly support: IntentProgramPlannedSupport;
  readonly presentation: IntentProgramPlannedPresentation;
  readonly motion: IntentProgramPlannedMotion;
}

export interface IntentProgramCompilerPlan {
  readonly program: IntentProgramIr;
  readonly compilation: IntentProgramCompilationPlan;
  readonly graph: IntentProgramStructuralGraph;
  readonly projectIntent: ProjectIntent;
  readonly authoring: AuthoringSelectionInput;
  readonly recipe: ConstrainedModelRecipe;
  readonly attachmentReflections: readonly IntentProgramAttachmentReflection[];
  readonly motionTargetPartId: string;
  readonly sourceMap: Readonly<Record<string, IntentProgramSpan>>;
}

export type CompileIntentProgramResult =
  | { readonly ok: true; readonly plan: IntentProgramCompilerPlan }
  | { readonly ok: false; readonly diagnostics: readonly IntentProgramDiagnostic[] };

export interface IntentProgramLoweringInput {
  readonly program: IntentProgramIr;
  readonly sourceMap: Readonly<Record<string, IntentProgramSpan>>;
}
