import type {
  AuthoringSelectionInput,
  AuthoringSlotAssignment
} from '../../authoring/authoringTypes';
import type {
  ConstrainedModelRecipe,
  ProjectIntent
} from '../../model';
import type {
  IntentProgramDiagnostic,
  IntentProgramIr,
  IntentProgramSpan
} from '../../project/intentProgramTypes';

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
  id: string;
  kind: IntentProgramGraphNodeKind;
  sourcePath: string;
  parentId: string | null;
  configuration: 'single' | 'paired';
  children: readonly string[];
}

export interface IntentProgramStructuralGraph {
  rootId: string;
  nodes: readonly IntentProgramGraphNode[];
}

/**
 * Compiler-owned counterpart relationship for geometry that is lowered once
 * and reflected across the semantic bilateral plane.  It is deliberately
 * separate from slots: attachment resolution is a geometry operation and
 * must derive the second member from the resolved first member, rather than
 * run two unrelated lattice tie-breaks.
 */
export interface IntentProgramAttachmentReflection {
  sourcePartId: string;
  reflectedPartId: string;
}

export interface IntentProgramCompilerPlan {
  program: IntentProgramIr;
  graph: IntentProgramStructuralGraph;
  projectIntent: ProjectIntent;
  authoring: AuthoringSelectionInput;
  recipe: ConstrainedModelRecipe;
  attachmentReflections: readonly IntentProgramAttachmentReflection[];
  sourceMap: Readonly<Record<string, IntentProgramSpan>>;
}

export type CompileIntentProgramResult =
  | { ok: true; plan: IntentProgramCompilerPlan }
  | { ok: false; diagnostics: readonly IntentProgramDiagnostic[] };

export interface IntentProgramLoweringInput {
  program: IntentProgramIr;
  sourceMap: Readonly<Record<string, IntentProgramSpan>>;
}

export type IntentProgramSlot = AuthoringSlotAssignment;
