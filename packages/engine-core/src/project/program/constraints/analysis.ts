import type { ProjectAppearanceV1 } from '../../appearance/contract';
import type {
  IntentProgramModule,
  IntentProgramSemanticAst,
  IntentProgramSurfaceDeclaration,
  IntentProgramSurfaceShape
} from '../types';
import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from '../language';
import type {
  IntentProgramConstraintInspection,
  IntentProgramConstraintIssue,
  IntentProgramConstraintMetrics
} from './contract';
import type { IntentProgramBodyGraph } from './graph';
import type { IntentProgramAttachmentClaims } from './slots';
import {
  intentProgramAllowsOccurrence,
  intentProgramCardinalityBounds,
  intentProgramCountSatisfiesCardinality,
  normalizeIntentProgramName,
  resolveIntentProgramVocabulary
} from '../schema';
import { INTENT_PROGRAM_INVARIANTS } from './policy';

export interface ConstraintCounters {
  attachmentConflictChecks: number;
  targetChecks: number;
  surfaceOrderComparisons: number;
  supportOrderComparisons: number;
}

export interface ConstraintState {
  readonly ast: IntentProgramSemanticAst;
  readonly issues: IntentProgramConstraintIssue[];
  readonly moduleIndex: Map<string, number>;
  readonly moduleById: Map<string, IntentProgramModule>;
  readonly surfaceById: Map<string, IntentProgramSurfaceDeclaration>;
  readonly shapeBySurface: Map<string, IntentProgramSurfaceShape>;
  readonly surfaceOrder: IntentProgramSurfaceDeclaration[];
  readonly supportContacts: string[];
  readonly attachmentSlots: Map<string, IntentProgramAttachmentClaims>;
  readonly presentationClaims: Map<string, string[]>;
  readonly counters: ConstraintCounters;
}

export interface ConstraintAnalysis {
  readonly inspection: IntentProgramConstraintInspection;
  readonly shapeBySurface: ReadonlyMap<string, IntentProgramSurfaceShape>;
  readonly surfaceOrder: readonly IntentProgramSurfaceDeclaration[];
  readonly supportContacts: readonly string[];
  readonly appearance: ProjectAppearanceV1 | null;
}

export const addConstraintIssue = (
  state: Pick<ConstraintState, 'issues'>,
  code: string,
  message: string,
  path: string
): void => {
  state.issues.push({ code, message, path });
};

const reportRequiredAuthorities = (state: ConstraintState): void => {
  const { ast } = state;
  const language = INTENT_PROGRAM_LANGUAGE_SPECIFICATION;
  const declaredAuthorities = new Map(Object.entries(ast.authorities));
  const requiredAuthorities = resolveIntentProgramVocabulary(
    language.statements.root.required
  );
  for (const block of requiredAuthorities) {
    const count = declaredAuthorities.get(block) ? 1 : 0;
    if (!intentProgramCountSatisfiesCardinality(
      count,
      language.statements.root.cardinalityPerBlock
    )) addConstraintIssue(
      state,
      'intent.missing_authority_block',
      `Missing required ${block} authority block.`,
      block
    );
  }
  const statements = language.statements;
  const leaves: readonly [number, unknown, string, string][] = [
    [intentProgramCardinalityBounds(statements.metadata.name.cardinality).min,
      ast.metadata.name, 'name', 'name'],
    [intentProgramCardinalityBounds(statements.metadata.track.cardinality).min,
      ast.metadata.track, 'track', 'track'],
    [intentProgramCardinalityBounds(statements.metadata.domain.cardinality).min,
      ast.metadata.domain, 'domain', 'domain'],
    [intentProgramCardinalityBounds(statements.model.orientation.cardinality).min,
      ast.model.orientation,
      'orientation forward', 'orientation.forward'],
    [intentProgramCardinalityBounds(statements.model.symmetry.cardinality).min,
      ast.model.symmetry,
      'symmetry', 'symmetry'],
    [intentProgramCardinalityBounds(statements.model.support.cardinality).min,
      ast.model.support, 'support', 'support'],
    [intentProgramCardinalityBounds(statements.model.face.cardinality).min,
      ast.model.face, 'face', 'face'],
    [intentProgramCardinalityBounds(statements.animation.idle.cardinality).min,
      ast.animation.idle,
      'animation idle', 'animation.idle']
  ];
  for (const [minimum, value, label, path] of leaves) {
    if (minimum > 0 && value === undefined) addConstraintIssue(
      state,
      'intent.missing_required',
      `Missing required ${label} declaration.`,
      path
    );
  }
  if (ast.metadata.name !== undefined) {
    const normalizedName = normalizeIntentProgramName(ast.metadata.name);
    if (INTENT_PROGRAM_INVARIANTS.name.nonEmpty && normalizedName.length === 0) {
      addConstraintIssue(
        state, 'intent.empty_name', 'Asset name cannot be empty.', 'name'
      );
    } else if (ast.metadata.name !== normalizedName) {
      addConstraintIssue(
        state,
        'intent.noncanonical_name',
        'Asset name must use the published whitespace normalization.',
        'name'
      );
    }
  }
};

const indexDeclarations = (state: ConstraintState): void => {
  const uniqueNamespaces =
    INTENT_PROGRAM_INVARIANTS.identifiers.uniqueWithinNamespaces;
  state.ast.model.body.forEach((module, index) => {
    if (uniqueNamespaces.includes('body') && state.moduleIndex.has(module.id)) {
      addConstraintIssue(
        state,
        'intent.duplicate_body_id',
        `Body module "${module.id}" is declared more than once.`,
        `body.${module.id}`
      );
      return;
    }
    state.moduleIndex.set(module.id, index);
    state.moduleById.set(module.id, module);
  });
  const seenSurfaces = new Set<string>();
  for (const surface of state.ast.model.surfaces) {
    if (uniqueNamespaces.includes('surfaces') && seenSurfaces.has(surface.id)) {
      addConstraintIssue(
      state,
      'intent.duplicate_surface_id',
      `Surface "${surface.id}" is declared more than once.`,
      `surfaces.${surface.id}`
      );
    }
    seenSurfaces.add(surface.id);
    if (!state.surfaceById.has(surface.id)) {
      state.surfaceById.set(surface.id, surface);
    }
  }
  if (!intentProgramCountSatisfiesCardinality(
    state.ast.model.surfaces.length,
    INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.model.surface.cardinality
  )) addConstraintIssue(
    state,
    'intent.invalid_surface_cardinality',
    'Model surface declaration count is outside the language contract.',
    'surfaces'
  );
  for (const declaration of state.ast.model.surfaceShapes) {
    const existingCount = state.shapeBySurface.has(declaration.surfaceId)
      ? 1
      : 0;
    if (!intentProgramAllowsOccurrence(
      existingCount,
      INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.model.shape.cardinality
    )) {
      addConstraintIssue(
        state,
        'intent.duplicate_surface_shape',
        `Shape for surface "${declaration.surfaceId}" is declared more than once.`,
        `surfaces.${declaration.surfaceId}.shape`
      );
      continue;
    }
    state.shapeBySurface.set(declaration.surfaceId, declaration.shape);
    if (INTENT_PROGRAM_INVARIANTS.references.surfaceShape.namespace ===
      'surfaces' && !state.surfaceById.has(declaration.surfaceId)) {
      addConstraintIssue(
      state,
      'intent.unknown_surface_shape_target',
      `Shape names unknown surface "${declaration.surfaceId}".`,
      `surfaces.${declaration.surfaceId}.shape`
      );
    }
  }
  const corePolicy = INTENT_PROGRAM_INVARIANTS.body.core;
  const coreCount = state.ast.model.body.reduce(
    (count, module) => count + (
      module.kind === corePolicy.kind &&
      module.cardinality === corePolicy.cardinality ? 1 : 0
    ),
    0
  );
  if (!intentProgramCountSatisfiesCardinality(
    state.ast.model.body.length,
    INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements.model.body.cardinality
  )) addConstraintIssue(
    state,
    'intent.invalid_body_cardinality',
    `Model body requires at least one module; found ${state.ast.model.body.length}.`,
    'body'
  );
  if (coreCount !== corePolicy.exactCount) addConstraintIssue(
    state,
    'intent.requires_one_core',
    `Model requires exactly ${corePolicy.exactCount} core body module; found ${coreCount}.`,
    'body'
  );
};

export const createConstraintState = (
  ast: IntentProgramSemanticAst
): ConstraintState => {
  const counters: ConstraintCounters = {
    attachmentConflictChecks: 0,
    targetChecks: 0,
    surfaceOrderComparisons: 0,
    supportOrderComparisons: 0
  };
  const state: ConstraintState = {
    ast,
    issues: [],
    moduleIndex: new Map(),
    moduleById: new Map(),
    surfaceById: new Map(),
    shapeBySurface: new Map(),
    surfaceOrder: [...ast.model.surfaces].sort((left, right) => {
      counters.surfaceOrderComparisons += 1;
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    }),
    supportContacts: [...(ast.model.support?.contacts ?? [])]
      .sort((left, right) => {
        counters.supportOrderComparisons += 1;
        return left < right ? -1 : left > right ? 1 : 0;
      }),
    attachmentSlots: new Map(),
    presentationClaims: new Map(),
    counters
  };
  reportRequiredAuthorities(state);
  indexDeclarations(state);
  return state;
};

export const finishConstraintAnalysis = (
  state: ConstraintState,
  graph: IntentProgramBodyGraph,
  appearance: ProjectAppearanceV1 | null
): ConstraintAnalysis => {
  const metrics: IntentProgramConstraintMetrics = {
    moduleCount: state.ast.model.body.length,
    surfaceCount: state.ast.model.surfaces.length,
    shapeCount: state.ast.model.surfaceShapes.length,
    markingCount: state.ast.appearance.markings.length,
    graphEdges: graph.edges,
    heapPushes: graph.heapPushes,
    heapPops: graph.heapPops,
    heapComparisons: graph.heapComparisons,
    surfaceOrderComparisons: state.counters.surfaceOrderComparisons,
    supportOrderComparisons: state.counters.supportOrderComparisons,
    attachmentConflictChecks: state.counters.attachmentConflictChecks,
    targetChecks: state.counters.targetChecks
  };
  return {
    inspection: { issues: state.issues, bodyOrder: graph.order, metrics },
    shapeBySurface: state.shapeBySurface,
    surfaceOrder: state.surfaceOrder,
    supportContacts: state.supportContacts,
    appearance
  };
};
