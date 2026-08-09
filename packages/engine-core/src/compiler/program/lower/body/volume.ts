import type { ModelPartLatticeVec3 } from '../../../../model';
import type {
  IntentProgramAttachedModule,
  IntentProgramModule
} from '../../../../project/program/types';
import { moduleStructuralRole } from '../../capability';
import { allocateBodyPort } from './ports';
import type { BodyEmissionPort } from '../context';
import type { IntentProgramModuleHost } from '../contract';
import {
  anchorDirection,
  attachment,
  bodyGrowthSpatialRelation,
  centeredOrAsymmetric,
  compilerPartCenter,
  compilerPartDirectionalReach,
  localDirection,
  localPoint,
  localRadii
} from '../spatial';

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

export const addCore = (
  state: BodyEmissionPort,
  module: IntentProgramModule
): string => {
  const partId = prefixed('core', module.id);
  const slotId = prefixed('slot.core', module.id);
  state.addParts({
    partId,
    parentPartId: null,
    materialId: 'mat.base',
    joint: { kind: 'fixed' },
    attachment: null,
    kind: 'mass',
    center: localPoint(state.intent, 0, 7, 0),
    radii: localRadii(state.intent, 4, 3, 4),
    profile: state.program.domain === 'organism' ? 'soft' : 'hard'
  });
  state.addSlot({
    slotId,
    structuralRole: moduleStructuralRole('core'),
    qualityStage: 'silhouette',
    partIds: [partId],
    parentSlotIds: [],
    spatialRelations: [],
    facing: null,
    symmetry: centeredOrAsymmetric(state.program),
    support: { kind: 'none' },
    span: { kind: 'none' }
  });
  state.addGraph({
    id: module.id,
    kind: 'core',
    sourcePath: modulePath(module),
    parentId: null,
    cardinality: 'single'
  });
  return partId;
};

export const addRequiredCoreStructure = (
  state: BodyEmissionPort,
  root: IntentProgramModule,
  rootPartId: string,
  rootSlotId: string
): void => {
  const partId = 'core.structure';
  const slotId = 'slot.core.structure';
  const start = localPoint(state.intent, 0, 8, 0);
  const end = localPoint(state.intent, 0, 11, 0);
  state.addParts({
    partId,
    parentPartId: rootPartId,
    materialId: 'mat.dark',
    joint: { kind: 'fixed' },
    attachment: attachment(start),
    kind: 'segment',
    points: [start, end],
    radii: [localRadii(state.intent, 1, 1, 1), localRadii(state.intent, 1, 1, 1)],
    profile: 'hard'
  });
  state.addSlot({
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
  state.addGraph({
    id: 'core.structure',
    kind: 'chain',
    sourcePath: modulePath(root),
    parentId: root.id,
    cardinality: 'single'
  });
};

const bodyAnchorDirection = (
  module: IntentProgramAttachedModule
) => {
  if (module.anchor === 'sides') {
    throw new Error('A single volume module cannot claim the paired sides anchor.');
  }
  return anchorDirection(module.anchor);
};

const axisFor = (point: ModelPartLatticeVec3): 'x' | 'y' | 'z' =>
  point[0] !== 0 ? 'x' : point[1] !== 0 ? 'y' : 'z';

const bodyPosition = (
  state: BodyEmissionPort,
  module: IntentProgramAttachedModule,
  parent: IntentProgramModuleHost,
  childReach: number
): { center: ModelPartLatticeVec3; growth: Exclude<typeof module.growth, 'outward'> } => {
  if (module.growth === 'outward') {
    throw new Error('A single volume module cannot use outward growth.');
  }
  const growth = module.growth;
  const anchor = bodyAnchorDirection(module);
  const port = allocateBodyPort(state, module.id);
  const parentPart = state.part(parent.partId);
  const parentCenter = compilerPartCenter(
    parentPart,
    localPoint(state.intent, 0, 7, 0)
  );
  const center = addPoints(
    parentCenter,
    localPoint(state.intent, port.lateral, port.up, port.forward),
    scalePoint(
      localDirection(state.intent, anchor),
      compilerPartDirectionalReach(state.intent, parentPart, anchor) - 1
    ),
    scalePoint(localDirection(state.intent, growth), childReach)
  );
  return { center, growth };
};

const massReach = (growth: Exclude<IntentProgramAttachedModule['growth'], 'outward'>): number =>
  growth === 'up' || growth === 'down' ? 2 : 3;

const addMassLike = (
  state: BodyEmissionPort,
  module: IntentProgramAttachedModule,
  parent: IntentProgramModuleHost
): IntentProgramModuleHost => {
  const partId = prefixed(module.kind, module.id);
  const slotId = prefixed('slot', module.id);
  const kind = module.kind === 'radial' ? 'radial' as const : 'mass' as const;
  const { center, growth } = bodyPosition(
    state,
    module,
    parent,
    kind === 'radial' ? 1 : massReach(
      module.growth === 'outward' ? 'left' : module.growth
    )
  );
  state.addParts(kind === 'radial'
    ? {
        partId,
        parentPartId: parent.partId,
        materialId: 'mat.base',
        joint: { kind: 'fixed' },
        attachment: attachment(center),
        kind,
        axis: axisFor(localDirection(state.intent, growth)),
        center,
        outerRadius: 3,
        innerRadius: 0,
        depth: 2
      }
    : {
        partId,
        parentPartId: parent.partId,
        materialId: 'mat.base',
        joint: { kind: 'fixed' },
        attachment: attachment(center),
        kind,
        center,
        radii: localRadii(state.intent, 3, 2, 3),
        profile: state.program.domain === 'organism' ? 'balanced' : 'hard'
      });
  state.addSlot({
    slotId,
    structuralRole: moduleStructuralRole(module.kind),
    qualityStage: 'structure',
    partIds: [partId],
    parentSlotIds: [parent.slotId],
    spatialRelations: [bodyGrowthSpatialRelation(growth)],
    facing: null,
    symmetry: centeredOrAsymmetric(state.program),
    support: { kind: 'none' },
    span: { kind: 'none' }
  });
  state.addGraph({
    id: module.id,
    kind: module.kind,
    sourcePath: modulePath(module),
    parentId: module.parent,
    cardinality: 'single'
  });
  return { moduleId: module.id, partId, slotId };
};

const addChain = (
  state: BodyEmissionPort,
  module: IntentProgramAttachedModule,
  parent: IntentProgramModuleHost
): IntentProgramModuleHost => {
  const partId = prefixed('chain', module.id);
  const slotId = prefixed('slot', module.id);
  if (module.growth === 'outward') {
    throw new Error('A single chain module cannot use outward growth.');
  }
  const growth = module.growth;
  const anchor = bodyAnchorDirection(module);
  const port = allocateBodyPort(state, module.id);
  const parentPart = state.part(parent.partId);
  const parentCenter = compilerPartCenter(
    parentPart,
    localPoint(state.intent, 0, 7, 0)
  );
  const direction = localDirection(state.intent, growth);
  const start = addPoints(
    parentCenter,
    localPoint(state.intent, port.lateral, port.up, port.forward),
    scalePoint(
      localDirection(state.intent, anchor),
      Math.max(
        0,
        compilerPartDirectionalReach(state.intent, parentPart, anchor) - 1
      )
    )
  );
  const end = addPoints(
    start,
    scalePoint(direction, growth === 'down' ? 3 : 4)
  );
  state.addParts({
    partId,
    parentPartId: parent.partId,
    materialId: 'mat.base',
    joint: { kind: 'ball' },
    attachment: attachment(start),
    kind: 'segment',
    points: [start, end],
    radii: [localRadii(state.intent, 2, 2, 2), localRadii(state.intent, 1, 1, 1)],
    profile: state.program.domain === 'organism' ? 'balanced' : 'hard'
  });
  state.addSlot({
    slotId,
    structuralRole: moduleStructuralRole(module.kind),
    qualityStage: 'structure',
    partIds: [partId],
    parentSlotIds: [parent.slotId],
    spatialRelations: [bodyGrowthSpatialRelation(growth)],
    facing: null,
    symmetry: centeredOrAsymmetric(state.program),
    support: { kind: 'none' },
    span: { kind: 'none' }
  });
  state.addGraph({
    id: module.id,
    kind: 'chain',
    sourcePath: modulePath(module),
    parentId: module.parent,
    cardinality: 'single'
  });
  return { moduleId: module.id, partId, slotId };
};

/** Emits core-attached volume topology; appendages use their own emitter. */
export const addVolumeBodyModule = (
  state: BodyEmissionPort,
  module: IntentProgramAttachedModule,
  parent: IntentProgramModuleHost
): IntentProgramModuleHost | null => {
  switch (module.kind) {
    case 'mass':
    case 'radial': return addMassLike(state, module, parent);
    case 'chain': return addChain(state, module, parent);
    case 'limb':
    case 'wheel': return null;
  }
};
