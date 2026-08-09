import {
  AUTHORING_PROFILE_SCHEMA_VERSION,
  type AuthoringFaceContract,
  type AuthoringSelectionInput,
  type AuthoringSlotAssignment
} from '../../authoring/authoringTypes';
import type {
  ConstrainedModelRecipe,
  ModelPartSpec,
  ProjectIntent
} from '../../model';
import { normalizePartRecipe } from '../../modeling/partRecipe';
import type {
  IntentProgramDiagnostic,
  IntentProgramIr,
  IntentProgramModule,
  IntentProgramSpan
} from '../../project/intentProgramTypes';
import { addAttachedBodyModule, addCore, addRequiredCoreStructure } from './bodyLowering';
import { intentProgramDiagnostic as diagnostic } from './diagnostics';
import { addFace, addSurface } from './faceSurfaceLowering';
import { addFocalCue } from './focalLowering';
import { validateIntentProgramModules } from './moduleValidation';
import { motionAuthoringSelection } from './motionLowering';
import { projectIntentProgramSemantics } from './semanticProjection';
import { sourcePathForRecipeIssue } from './sourceOwnership';
import {
  addBaseSupport,
  addFootSupports,
  addWheelSupports
} from './supportLowering';
import type { BuildState, IntentProgramModuleHost } from './state';
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
    if (kind === 'focal') return slot.slotId === `slot.focal.${id}`;
    return slot.slotId === `slot.${id}`;
  }).map((slot) => slot.slotId);
  return {
    featureRef: `intent.features.${index}`,
    slotIds,
    materialIds: []
  };
});

const authoringSelection = (
  program: IntentProgramIr,
  intent: ProjectIntent,
  slots: readonly AuthoringSlotAssignment[],
  face: AuthoringFaceContract | null
): AuthoringSelectionInput => {
  const motion = motionAuthoringSelection();
  return {
    archetype: {
      id: 'archetype.composable-form', version: AUTHORING_PROFILE_SCHEMA_VERSION
    },
    track: program.track,
    restPose: {
      kind: 'canonical-neutral',
      mode: program.rest.kind === 'feet' ? 'standing'
        : program.rest.kind === 'base' ? 'supported'
          : program.rest.kind === 'wheels' ? 'rolling'
            : program.rest.kind === 'airborne' ? 'airborne' : 'free'
    },
    faceMode: face ? 'full' : 'none',
    face,
    specialists: motion.specialists,
    claims: [{
      authority: {
        id: 'archetype.composable-form', version: AUTHORING_PROFILE_SCHEMA_VERSION
      },
      criterionId: 'criterion.structure-graph',
      basis: 'requested',
      referenceIds: ['intent.subject'],
      rationale: `The confirmed Intent Program for ${intent.subject} explicitly declares its structural graph.`
    }, ...motion.claims],
    slots: [...slots].sort((left, right) => left.slotId.localeCompare(right.slotId)),
    coverage: collectCoverage(intent, slots),
    bindings: motion.bindings
  };
};

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
  if (!(palette in colors)) {
    return {
      ok: false,
      diagnostics: [diagnostic(
        sourceMap,
        'style.palette',
        'intent-program.invalid-palette',
        `Palette "${String(palette)}" is not a compiler-owned palette.`
      )]
    };
  }
  const paletteId = palette as keyof typeof colors;
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
      sourcePathForRecipeIssue(issue.path, parts),
      'intent-program.part-recipe-invalid',
      `${issue.path}: ${issue.message}`
    ))
  };
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
    moduleHosts: new Map(),
    bodyPortCounts: new Map(),
    limbPairs: new Map(),
    wheelPairs: new Map()
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
      module.kind !== 'core' &&
      module.from !== undefined &&
      module.extension !== undefined &&
      state.moduleHosts.has(module.from)
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
      if (
        module.kind === 'core' ||
        module.from === undefined ||
        module.extension === undefined
      ) {
        return { ok: false, diagnostics: [diagnostic(
          input.sourceMap,
          modulePath(module),
          'intent-program.invalid-attached-module',
          `Body module "${module.id}" requires both from <module> and extends <direction>.`
        )] };
      }
      const host = addAttachedBodyModule(
        state,
        module,
        state.moduleHosts.get(module.from)!
      );
      if (host) state.moduleHosts.set(module.id, host);
      pending.delete(module.id);
    }
  }
  const faceHost = input.program.face.kind === 'full'
    ? state.moduleHosts.get(input.program.face.on)
    : rootHost;
  if (input.program.face.kind === 'full' && !faceHost) {
    return { ok: false, diagnostics: [diagnostic(
      input.sourceMap,
      'face.on',
      'intent-program.unresolvable-face-host',
      `Face host "${input.program.face.on}" must resolve to a structural body module.`
    )] };
  }
  const face = addFace(state, faceHost ?? rootHost);
  if (input.program.focal) {
    const focalHost = state.moduleHosts.get(input.program.focal.on);
    if (!focalHost) {
      return { ok: false, diagnostics: [diagnostic(
        input.sourceMap,
        'focal.on',
        'intent-program.unresolvable-focal-host',
        `Focal host "${input.program.focal.on}" must resolve to a structural body module.`
      )] };
    }
    addFocalCue(state, input.program.focal, focalHost);
  }
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
  if (input.program.rest.kind === 'feet') {
    const limb = state.limbPairs.get(input.program.rest.on);
    if (!limb) {
      return { ok: false, diagnostics: [diagnostic(
        input.sourceMap,
        'rest.on',
        'intent-program.unresolvable-foot-support',
        `Standing feet must name one declared paired limb module; "${input.program.rest.on}" is not eligible.`
      )] };
    }
    addFootSupports(state, limb);
  }
  if (input.program.rest.kind === 'base') {
    const host = state.moduleHosts.get(input.program.rest.on);
    if (!host) {
      return { ok: false, diagnostics: [diagnostic(
        input.sourceMap,
        'rest.on',
        'intent-program.unresolvable-base-support',
        `Base support must name a core, mass, chain, or radial body host; "${input.program.rest.on}" is not eligible.`
      )] };
    }
    addBaseSupport(state, host);
  }
  if (input.program.rest.kind === 'wheels') {
    const wheels = state.wheelPairs.get(input.program.rest.on);
    if (!wheels) {
      return { ok: false, diagnostics: [diagnostic(
        input.sourceMap,
        'rest.on',
        'intent-program.unresolvable-wheel-support',
        `Rolling support must name one declared paired wheel module; "${input.program.rest.on}" is not eligible.`
      )] };
    }
    addWheelSupports(state, wheels);
  }
  const recipeResult = compileRecipe(
    state.parts,
    input.sourceMap,
    input.program.style.palette
  );
  if (!recipeResult.ok) return recipeResult;
  const plan: IntentProgramCompilerPlan = {
    program: input.program,
    graph: { rootId: root.id, nodes: connectGraph(state) },
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
  if (diagnostics.length > 0) return { ok: false, diagnostics };
  const semantic = projectIntentProgramSemantics(input.program, input.sourceMap);
  if (!semantic.ok) return { ok: false, diagnostics: semantic.diagnostics };
  return lower(input, semantic.intent);
};
