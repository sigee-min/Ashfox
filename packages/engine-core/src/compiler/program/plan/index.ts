import type {
  IntentProgramIr,
  IntentProgramModule,
  IntentProgramSurface
} from '../../../project/program/types';
import { compareStableText } from '../../../stableOrder';
import { resolveSurfaceShape } from '../lower/surface/shape';
import type {
  IntentProgramCompilationPlan,
  IntentProgramPlannedAttachment,
  IntentProgramPlannedPresentation,
  IntentProgramPlannedSurface,
  IntentProgramPlannedSupport
} from '../contract';

const stable = <T extends { readonly id: string }>(
  entries: readonly T[]
): readonly T[] => [...entries].sort((left, right) =>
  compareStableText(left.id, right.id)
);

const frozen = <T>(entries: readonly T[]): readonly T[] =>
  Object.freeze([...entries]);

const supportPlan = (
  program: IntentProgramIr
): IntentProgramPlannedSupport => {
  if (program.support.kind === 'none') {
    return Object.freeze({
      kind: 'none',
      moduleIds: Object.freeze([]) as readonly []
    });
  }
  if (program.support.kind === 'base') {
    return Object.freeze({
      kind: 'base',
      moduleIds: Object.freeze([
        program.support.contacts[0]
      ]) as readonly [string]
    });
  }
  return Object.freeze({
    kind: program.support.kind,
    moduleIds: frozen(program.support.contacts)
  });
};

const presentationPlan = (
  program: IntentProgramIr
): IntentProgramPlannedPresentation => {
  if (program.face.kind === 'full') {
    return Object.freeze({ kind: 'face', hostModuleId: program.face.parent });
  }
  if (program.focal) {
    return Object.freeze({
      kind: 'focal',
      focalId: program.focal.id,
      hostModuleId: program.focal.parent
    });
  }
  return Object.freeze({ kind: 'none' });
};

const surfacePlan = (
  program: IntentProgramIr
): readonly IntentProgramPlannedSurface[] => {
  const ordered = stable(program.surfaces);
  const groups = new Map<string, IntentProgramSurface[]>();
  const ordinals = new Map<string, number>();
  for (const surface of ordered) {
    const key = `${surface.parent}:${surface.anchor}:${surface.lane}`;
    const peers = groups.get(key);
    ordinals.set(surface.id, peers?.length ?? 0);
    if (peers) peers.push(surface);
    else groups.set(key, [surface]);
  }
  return ordered.map((surface): IntentProgramPlannedSurface => {
    const sourcePath = `surfaces.${surface.id}`;
    const groupKey = `${surface.parent}:${surface.anchor}:${surface.lane}`;
    const peers = groups.get(groupKey) ?? [];
    const ordinal = ordinals.get(surface.id) ?? 0;
    const shape = resolveSurfaceShape(surface);
    return Object.freeze({
      id: surface.id,
      role: surface.role,
      cardinality: surface.cardinality,
      hostModuleId: surface.parent,
      anchor: surface.anchor,
      growth: surface.growth,
      lane: surface.lane,
      portKey: `${groupKey}:${ordinal}`,
      portOffset: peers.length === 1 ? 0 : ordinal === 0 ? -2 : 2,
      sourcePath,
      ...(shape === undefined ? {} : { shape })
    });
  });
};

/** Projects validated canonical IR into immutable compiler-owned ports. */
export const planIntentProgram = (
  program: IntentProgramIr
): IntentProgramCompilationPlan => {
  const root = program.body[0];
  if (!root || root.kind !== 'core') {
    throw new Error('Validated Intent Program has no canonical core root.');
  }
  const attachments: IntentProgramPlannedAttachment[] = program.body.flatMap(
    (module): readonly IntentProgramPlannedAttachment[] => module.kind === 'core'
      ? []
      : [Object.freeze({
        moduleId: module.id,
        hostModuleId: module.parent,
        anchor: module.anchor,
        growth: module.growth,
        lane: module.lane,
        portKey: `${module.parent}:${module.anchor}:${module.lane}`,
        sourcePath: `body.${module.id}`
      })]
  );
  const motionTarget = program.animation.idle.target ?? root.id;
  const surfaces = surfacePlan(program);
  const immutableModules = program.body.map((module) => Object.freeze({
    ...module
  } satisfies IntentProgramModule));
  return Object.freeze({
    rootModuleId: root.id,
    modules: frozen(immutableModules),
    attachments: frozen(attachments),
    surfaces: frozen(surfaces),
    support: supportPlan(program),
    presentation: presentationPlan(program),
    motion: Object.freeze({
      mode: program.animation.idle.mode,
      targetModuleId: motionTarget
    })
  });
};
