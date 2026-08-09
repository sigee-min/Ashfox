import {
  AUTHORING_PROFILE_SCHEMA_VERSION,
  type AuthoringFaceContract,
  type AuthoringSelectionInput,
  type AuthoringSlotAssignment
} from '../../authoring/authoringTypes';
import type {
  ConstrainedModelRecipe,
  ModelPartLatticeVec3,
  ModelPartSpec,
  ProjectIntent
} from '../../model';
import { normalizePartRecipe } from '../../modeling/partRecipe';
import { projectSpatialFrame } from '../../project/projectSpatialFrame';
import type {
  IntentProgramDiagnostic,
  IntentProgramIr,
  IntentProgramModule,
  IntentProgramSpan
} from '../../project/intentProgramTypes';
import { projectIntentProgramSemantics } from './semanticProjection';
import { addFace, addSurface } from './faceSurfaceLowering';
import { addBaseSupport, addFootSupports } from './supportLowering';
import { intentProgramDiagnostic as diagnostic } from './diagnostics';
import { validateIntentProgramModules } from './moduleValidation';
import {
  addGraph,
  addSlot,
  attachment,
  centeredOrAsymmetric,
  compilerHostAnchor,
  compilerPartPlanarReach,
  compilerPartVerticalReach,
  localPoint,
  type BuildState,
  type IntentProgramModuleHost,
  type Side,
  sideRelation,
  sideSymmetry
} from './state';
import type {
  CompileIntentProgramResult,
  IntentProgramCompilerPlan,
  IntentProgramGraphNode,
  IntentProgramLoweringInput
} from './types';

const stable = <T extends { id: string }>(entries: readonly T[]): readonly T[] =>
  [...entries].sort((left, right) => left.id.localeCompare(right.id));

const unique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const modulePath = (module: IntentProgramModule): string =>
  `body.${module.id}`;

const prefixed = (prefix: string, id: string): string => `${prefix}.${id}`;

const addPoints = (
  ...points: readonly ModelPartLatticeVec3[]
): ModelPartLatticeVec3 => points.reduce<ModelPartLatticeVec3>(
  (total, point) => [
    total[0] + point[0],
    total[1] + point[1],
    total[2] + point[2]
  ],
  [0, 0, 0]
);

const scalePoint = (
  point: ModelPartLatticeVec3,
  amount: number
): ModelPartLatticeVec3 => [
  point[0] * amount,
  point[1] * amount,
  point[2] * amount
];

const connectGraph = (state: BuildState): readonly IntentProgramGraphNode[] => {
  const children = new Map<string, string[]>();
  for (const node of state.graph) {
    if (!node.parentId) continue;
    children.set(node.parentId, [...(children.get(node.parentId) ?? []), node.id]);
  }
  return stable(state.graph).map((node) => ({
    ...node,
    children: unique(children.get(node.id) ?? [])
  }));
};

const addCore = (state: BuildState, module: IntentProgramModule): string => {
  const partId = prefixed('core', module.id);
  const slotId = prefixed('slot.core', module.id);
  state.parts.push({
    partId,
    parentPartId: null,
    materialId: 'mat.base',
    joint: { kind: 'fixed' },
    attachment: null,
    kind: 'mass',
    center: localPoint(state.intent, 0, 7, 0),
    radii: [4, 3, 4],
    profile: state.program.domain === 'organism' ? 'soft' : 'hard'
  });
  addSlot(state, {
    slotId,
    structuralRole: 'core',
    qualityStage: 'silhouette',
    partIds: [partId],
    parentSlotIds: [],
    spatialRelations: [],
    facing: null,
    symmetry: centeredOrAsymmetric(state.program),
    support: { kind: 'none' },
    span: { kind: 'none' }
  });
  addGraph(state, {
    id: module.id,
    kind: 'core',
    sourcePath: modulePath(module),
    parentId: null,
    configuration: 'single'
  });
  return partId;
};

const addRequiredCoreStructure = (
  state: BuildState,
  root: IntentProgramModule,
  rootPartId: string,
  rootSlotId: string
): void => {
  const partId = 'core.structure';
  const slotId = 'slot.core.structure';
  const start = localPoint(state.intent, 0, 8, 0);
  const end = localPoint(state.intent, 0, 11, 0);
  state.parts.push({
    partId,
    parentPartId: rootPartId,
    materialId: 'mat.dark',
    joint: { kind: 'fixed' },
    attachment: attachment(start),
    kind: 'segment',
    points: [start, end],
    radii: [[1, 1, 1], [1, 1, 1]],
    profile: 'hard'
  });
  addSlot(state, {
    slotId,
    structuralRole: 'axis',
    qualityStage: 'structure',
    partIds: [partId],
    parentSlotIds: [rootSlotId],
    spatialRelations: ['above'],
    facing: null,
    symmetry: centeredOrAsymmetric(state.program),
    support: { kind: 'none' },
    span: { kind: 'none' }
  });
  addGraph(state, {
    id: 'core.structure',
    kind: 'chain',
    sourcePath: modulePath(root),
    parentId: root.id,
    configuration: 'single'
  });
};

const addMassLike = (
  state: BuildState,
  module: IntentProgramModule,
  parent: IntentProgramModuleHost
): IntentProgramModuleHost => {
  const partId = prefixed(module.kind, module.id);
  const slotId = prefixed('slot', module.id);
  const parentPartId = parent.partId;
  const parentSlotIds = [parent.slotId];
  const parentPart = state.parts.find((part) => part.partId === parentPartId);
  const parentAnchor = compilerHostAnchor(
    state.intent,
    parentPart,
    localPoint(state.intent, 0, 5, 0)
  );
  const kind = module.kind === 'radial' ? 'radial' as const : 'mass' as const;
  const center = addPoints(
    parentAnchor,
    scalePoint(
      localPoint(state.intent, 0, kind === 'radial' ? 1 : 0, kind === 'radial' ? 0 : 1),
      kind === 'radial'
        ? compilerPartVerticalReach(parentPart) + 1
        : compilerPartPlanarReach(parentPart) + 2
    )
  );
  state.parts.push(kind === 'radial'
    ? {
        partId, parentPartId, materialId: 'mat.base', joint: { kind: 'fixed' },
        attachment: attachment(center), kind,
        axis: 'y', center,
        outerRadius: 3, innerRadius: 0, depth: 2
      }
    : {
        partId, parentPartId, materialId: 'mat.base', joint: { kind: 'fixed' },
        attachment: attachment(center), kind,
        center, radii: [3, 2, 3],
        profile: state.program.domain === 'organism' ? 'balanced' : 'hard'
      });
  addSlot(state, {
    slotId, structuralRole: module.kind === 'mass' ? 'core' : 'axis',
    qualityStage: 'structure', partIds: [partId], parentSlotIds,
    spatialRelations: [], facing: null,
    symmetry: centeredOrAsymmetric(state.program), support: { kind: 'none' },
    span: { kind: 'none' }
  });
  addGraph(state, {
    id: module.id, kind: module.kind, sourcePath: modulePath(module),
    parentId: module.from ?? state.program.body.find((entry) => entry.kind === 'core')?.id ?? null,
    configuration: 'single'
  });
  return { moduleId: module.id, partId, slotId };
};

const addChain = (
  state: BuildState,
  module: IntentProgramModule,
  parent: IntentProgramModuleHost
): IntentProgramModuleHost => {
  const partId = prefixed('chain', module.id);
  const slotId = prefixed('slot', module.id);
  const parentPart = state.parts.find((part) => part.partId === parent.partId);
  const parentAnchor = compilerHostAnchor(
    state.intent,
    parentPart,
    localPoint(state.intent, 0, 5, 0)
  );
  const start = addPoints(
    parentAnchor,
    scalePoint(
      localPoint(state.intent, 0, 0, 1),
      compilerPartPlanarReach(parentPart) - 1
    )
  );
  const end = addPoints(start, scalePoint(localPoint(state.intent, 0, 0, 1), 4));
  state.parts.push({
    partId,
    parentPartId: parent.partId,
    materialId: 'mat.base',
    joint: { kind: 'ball' },
    attachment: attachment(start),
    kind: 'segment',
    points: [start, end],
    radii: [[2, 2, 2], [1, 1, 1]],
    profile: state.program.domain === 'organism' ? 'balanced' : 'hard'
  });
  addSlot(state, {
    slotId, structuralRole: 'axis', qualityStage: 'structure', partIds: [partId],
    parentSlotIds: [parent.slotId], spatialRelations: ['front'], facing: null,
    symmetry: centeredOrAsymmetric(state.program), support: { kind: 'none' },
    span: { kind: 'none' }
  });
  addGraph(state, {
    id: module.id, kind: 'chain', sourcePath: modulePath(module),
    parentId: module.from ?? state.program.body.find((entry) => entry.kind === 'core')?.id ?? null,
    configuration: 'single'
  });
  return { moduleId: module.id, partId, slotId };
};

const addLimb = (
  state: BuildState,
  module: IntentProgramModule,
  parent: IntentProgramModuleHost
): void => {
  const sides: readonly Side[] = module.configuration === 'single'
    ? ['left']
    : ['left', 'right'];
  const pairId = prefixed('pair', module.id);
  const parentPart = state.parts.find((part) => part.partId === parent.partId);
  const parentAnchor = compilerHostAnchor(
    state.intent,
    parentPart,
    localPoint(state.intent, 0, 5, 0)
  );
  for (const side of sides) {
    // A ±5 semantic center produces exact reflected 2-cell-thick limbs
    // that touch the core's lateral face after lattice seam ownership.
    const lateral = side === 'left' ? 5 : -5;
    const partId = prefixed(`limb.${side}`, module.id);
    const slotId = prefixed(`slot.limb.${side}`, module.id);
    const start = addPoints(parentAnchor, localPoint(state.intent, lateral, -1, 0));
    const end = addPoints(parentAnchor, localPoint(state.intent, lateral, -3, 1));
    state.parts.push({
      partId, parentPartId: parent.partId, materialId: 'mat.base',
      joint: { kind: 'ball' }, attachment: attachment(start),
      kind: 'segment',
      points: [start, end],
      radii: [[1, 1, 1], [1, 1, 1]], profile: 'balanced'
    });
    addSlot(state, {
      slotId, structuralRole: 'articulated', qualityStage: 'structure', partIds: [partId],
      parentSlotIds: [parent.slotId], spatialRelations: sideRelation(side), facing: null,
      symmetry: sides.length === 2 ? sideSymmetry(pairId) : centeredOrAsymmetric(state.program),
      support: { kind: 'none' }, span: { kind: 'none' }
    });
  }
  addGraph(state, {
    id: module.id, kind: 'limb', sourcePath: modulePath(module),
    parentId: module.from ?? state.program.body.find((entry) => entry.kind === 'core')?.id ?? null,
    configuration: module.configuration ?? 'paired'
  });
};

const addWheel = (
  state: BuildState,
  module: IntentProgramModule,
  parent: IntentProgramModuleHost
): void => {
  const sides: readonly Side[] = module.configuration === 'single'
    ? ['left'] : ['left', 'right'];
  const pairId = prefixed('pair', module.id);
  const parentPart = state.parts.find((part) => part.partId === parent.partId);
  const parentAnchor = compilerHostAnchor(
    state.intent,
    parentPart,
    localPoint(state.intent, 0, 5, 0)
  );
  const frame = projectSpatialFrame(state.intent);
  const axis = frame.lateralAxis;
  for (const side of sides) {
    // Cell reflection around plane 0 maps a positive radial center at 4 to
    // its negative-side counterpart at -5. `left` reverses along north/east.
    const lateral = frame.lateralSign === 1
      ? side === 'left' ? 5 : -4
      : side === 'left' ? 4 : -5;
    const partId = prefixed(`wheel.${side}`, module.id);
    const slotId = prefixed(`slot.wheel.${side}`, module.id);
    const center = addPoints(parentAnchor, localPoint(state.intent, lateral, -3, 0));
    state.parts.push({
      partId, parentPartId: parent.partId, materialId: 'mat.dark', joint: { kind: 'hinge', axis },
      attachment: attachment(center), kind: 'radial', axis,
      center, outerRadius: 2, innerRadius: 1, depth: 1
    });
    addSlot(state, {
      slotId, structuralRole: 'articulated', qualityStage: 'structure', partIds: [partId],
      parentSlotIds: [parent.slotId], spatialRelations: sideRelation(side), facing: null,
      symmetry: sides.length === 2 ? sideSymmetry(pairId) : centeredOrAsymmetric(state.program),
      support: { kind: 'none' }, span: { kind: 'none' }
    });
  }
  addGraph(state, {
    id: module.id, kind: 'wheel', sourcePath: modulePath(module),
    parentId: module.from ?? state.program.body.find((entry) => entry.kind === 'core')?.id ?? null,
    configuration: module.configuration ?? 'paired'
  });
};

const collectCoverage = (
  intent: ProjectIntent,
  slots: readonly AuthoringSlotAssignment[]
) => intent.features.map((feature, index) => {
  const separator = feature.indexOf(':');
  const kind = feature.slice(0, separator);
  const id = feature.slice(separator + 1);
  const slotIds = slots.filter((slot) => {
    if (kind === 'core') return slot.slotId === `slot.core.${id}`;
    if (kind === 'limb' || kind === 'wheel') {
      return slot.slotId.startsWith(`slot.${kind}.`) &&
        slot.slotId.endsWith(`.${id}`);
    }
    if (['wing', 'fin', 'sail', 'panel'].includes(kind)) {
      return slot.slotId.startsWith(`slot.surface.${id}.`);
    }
    return slot.slotId === `slot.${id}`;
  }).map((slot) => slot.slotId);
  return {
    featureRef: `intent.features.${index}`,
    slotIds,
    // Structural ownership is the durable realization proof. Palette is a
    // program-wide rendering policy, not a randomly assigned per-feature
    // requirement that can make a valid compiler output unready.
    materialIds: []
  };
});

const authoringSelection = (
  program: IntentProgramIr,
  intent: ProjectIntent,
  slots: readonly AuthoringSlotAssignment[],
  face: AuthoringFaceContract | null
): AuthoringSelectionInput => ({
  archetype: {
    id: 'archetype.composable-form', version: AUTHORING_PROFILE_SCHEMA_VERSION
  },
  track: program.track,
  restPose: {
    kind: 'canonical-neutral',
    mode: program.rest.kind === 'feet' ? 'standing'
      : program.rest.kind === 'base' ? 'supported'
        : program.rest.kind === 'airborne' ? 'airborne' : 'free'
  },
  faceMode: face ? 'full' : 'none',
  face,
  specialists: [],
  claims: [{
    authority: {
      id: 'archetype.composable-form', version: AUTHORING_PROFILE_SCHEMA_VERSION
    },
    criterionId: 'criterion.structure-graph',
    basis: 'requested',
    referenceIds: ['intent.subject'],
    rationale: `The intent program for ${intent.subject} explicitly declares its structural graph.`
  }],
  slots: [...slots].sort((left, right) => left.slotId.localeCompare(right.slotId)),
  coverage: collectCoverage(intent, slots),
  bindings: []
});

const compileRecipe = (
  parts: readonly ModelPartSpec[],
  sourceMap: Readonly<Record<string, IntentProgramSpan>>,
  palette: IntentProgramIr['style']['palette']
):
  | { ok: true; recipe: ConstrainedModelRecipe }
  | { ok: false; diagnostics: readonly IntentProgramDiagnostic[] } => {
  const colors = {
    natural: ['#738A6D', '#20242A', '#10131A', '#C38B4A'],
    ember: ['#7C3025', '#241719', '#110D0F', '#E89A35'],
    ocean: ['#285E78', '#142630', '#0B1218', '#68B8C7'],
    noir: ['#4B4D54', '#18191D', '#090A0C', '#B7BAC0'],
    metal: ['#65717B', '#252C33', '#0A0E12', '#C48C47'],
    gold: ['#8C682C', '#332714', '#161006', '#E6B84E']
  } as const;
  const paletteId = palette && palette in colors ? palette as keyof typeof colors : 'natural';
  const [base, dark, eye, accent] = colors[paletteId];
  const normalized = normalizePartRecipe(parts, [
    { id: 'mat.base', baseColor: base },
    { id: 'mat.dark', baseColor: dark },
    { id: 'mat.eye', baseColor: eye },
    { id: 'mat.accent', baseColor: accent }
  ]);
  if (normalized.ok) return { ok: true, recipe: normalized.recipe };
  return {
    ok: false,
    diagnostics: normalized.issues.map((issue) => diagnostic(
      sourceMap,
      'asset',
      'intent-program.part-recipe-invalid',
      `${issue.path}: ${issue.message}`
    ))
  };
};

const dot = (
  left: ModelPartLatticeVec3,
  right: ModelPartLatticeVec3
): number => left[0] * right[0] + left[1] * right[1] + left[2] * right[2];

const canonicalFaceHost = (
  state: BuildState,
  fallback: IntentProgramModuleHost
): IntentProgramModuleHost => {
  const forward = projectSpatialFrame(state.intent).forward;
  return [...state.moduleHosts.values()].sort((left, right) => {
    const leftPart = state.parts.find((part) => part.partId === left.partId);
    const rightPart = state.parts.find((part) => part.partId === right.partId);
    const leftDepth = dot(
      compilerHostAnchor(state.intent, leftPart, [0, 0, 0]),
      forward
    );
    const rightDepth = dot(
      compilerHostAnchor(state.intent, rightPart, [0, 0, 0]),
      forward
    );
    return rightDepth - leftDepth || left.moduleId.localeCompare(right.moduleId);
  })[0] ?? fallback;
};

const lower = (
  input: IntentProgramLoweringInput,
  intent: ProjectIntent
): CompileIntentProgramResult => {
  const root = input.program.body.find((module) => module.kind === 'core');
  if (!root) {
    return { ok: false, diagnostics: [diagnostic(
      input.sourceMap, 'body', 'intent-program.root-core',
      'An intent program must declare exactly one core body module.'
    )] };
  }
  const state: BuildState = {
    program: input.program,
    intent,
    parts: [],
    slots: [],
    graph: [],
    attachmentReflections: [],
    partSlot: new Map(),
    moduleHosts: new Map()
  };
  const rootPartId = addCore(state, root);
  const rootSlotId = `slot.core.${root.id}`;
  const rootHost: IntentProgramModuleHost = {
    moduleId: root.id,
    partId: rootPartId,
    slotId: rootSlotId
  };
  state.moduleHosts.set(root.id, rootHost);
  if (
    input.program.track === 'essential' &&
    input.program.face.kind === 'none' &&
    input.program.body.length === 1 &&
    input.program.rest.kind === 'airborne' &&
    input.program.surfaces.length === 0
  ) {
    addRequiredCoreStructure(state, root, rootPartId, rootSlotId);
  }
  const pending = new Map(
    input.program.body
      .filter((entry) => entry.id !== root.id)
      .map((entry) => [entry.id, entry])
  );
  while (pending.size > 0) {
    const ready = stable([...pending.values()].filter((module) =>
      module.from === undefined || state.moduleHosts.has(module.from)
    ));
    if (ready.length === 0) {
      return { ok: false, diagnostics: [diagnostic(
        input.sourceMap,
        'body',
        'intent-program.unresolvable-module-host',
        'Body modules must form one acyclic hierarchy rooted at the core.'
      )] };
    }
    for (const module of ready) {
      const parent = module.from
        ? state.moduleHosts.get(module.from)!
        : rootHost;
      let host: IntentProgramModuleHost | null = null;
      switch (module.kind) {
        case 'mass':
        case 'radial': host = addMassLike(state, module, parent); break;
        case 'chain': host = addChain(state, module, parent); break;
        case 'limb': addLimb(state, module, parent); break;
        case 'wheel': addWheel(state, module, parent); break;
        case 'core': break;
      }
      if (host) state.moduleHosts.set(module.id, host);
      pending.delete(module.id);
    }
  }
  const face = addFace(state, canonicalFaceHost(state, rootHost));
  for (const surface of stable(input.program.surfaces)) {
    const host = state.moduleHosts.get(surface.from);
    if (!host) {
      return { ok: false, diagnostics: [diagnostic(
        input.sourceMap,
        `surfaces.${surface.id}.from`,
        'intent-program.unresolvable-surface-host',
        `Surface "${surface.id}" requires a resolved structural host.`
      )] };
    }
    addSurface(state, surface, host.partId, host.slotId);
  }
  addFootSupports(state, rootPartId, rootSlotId);
  addBaseSupport(state, rootPartId, rootSlotId);
  const recipeResult = compileRecipe(
    state.parts,
    input.sourceMap,
    input.program.style.palette
  );
  if (!recipeResult.ok) return recipeResult;
  const graph = connectGraph(state);
  const plan: IntentProgramCompilerPlan = {
    program: input.program,
    graph: { rootId: root.id, nodes: graph },
    projectIntent: intent,
    authoring: authoringSelection(input.program, intent, state.slots, face),
    recipe: recipeResult.recipe,
    attachmentReflections: state.attachmentReflections,
    sourceMap: input.sourceMap
  };
  return { ok: true, plan };
};

export const compileIntentProgram = (
  input: IntentProgramLoweringInput
): CompileIntentProgramResult => {
  const diagnostics = validateIntentProgramModules(input.program, input.sourceMap);
  const semantic = projectIntentProgramSemantics(input.program, input.sourceMap);
  if (!semantic.ok || diagnostics.length > 0) {
    return {
      ok: false,
      diagnostics: [...diagnostics, ...(semantic.ok ? [] : semantic.diagnostics)]
    };
  }
  return lower(input, semantic.intent);
};
