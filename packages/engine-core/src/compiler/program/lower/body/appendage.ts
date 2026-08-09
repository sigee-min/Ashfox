import type { ModelPartLatticeVec3 } from '../../../../model';
import { projectSpatialFrame } from '../../../../project/frame';
import type { IntentProgramAttachedModule } from '../../../../project/program/types';
import { allocateBodyPort } from './ports';
import { moduleStructuralRole } from '../../capability';
import type { BodyEmissionPort } from '../context';
import type {
  IntentProgramLimbMember,
  IntentProgramModuleHost,
  IntentProgramWheelMember,
  Side
} from '../contract';
import {
  attachment,
  bodyGrowthSpatialRelation,
  centeredOrAsymmetric,
  compilerPartCenter,
  compilerPartDirectionalReach,
  localDirection,
  localPoint,
  localRadii,
  memberGrowthDirection,
  sideRelation,
  sideSymmetry
} from '../spatial';

const prefixed = (prefix: string, id: string): string => `${prefix}.${id}`;
const modulePath = (module: IntentProgramAttachedModule): string =>
  `body.${module.id}`;
const addPoints = (...points: readonly ModelPartLatticeVec3[]): ModelPartLatticeVec3 =>
  points.reduce<ModelPartLatticeVec3>((total, point) => [
    total[0] + point[0], total[1] + point[1], total[2] + point[2]
  ], [0, 0, 0]);
const scalePoint = (
  point: ModelPartLatticeVec3,
  amount: number
): ModelPartLatticeVec3 => [
  point[0] * amount, point[1] * amount, point[2] * amount
];
const addLimb = (
  state: BodyEmissionPort,
  module: IntentProgramAttachedModule,
  parent: IntentProgramModuleHost
): void => {
  const sides: readonly Side[] = module.cardinality === 'paired'
    ? ['left', 'right']
    : [module.anchor === 'right' ? 'right' : 'left'];
  const pairId = prefixed('pair', module.id);
  const port = allocateBodyPort(state, module.id);
  const parentPart = state.part(parent.partId);
  const parentCenter = compilerPartCenter(
    parentPart, localPoint(state.intent, 0, 7, 0)
  );
  const baseSideDistance = compilerPartDirectionalReach(
    state.intent, parentPart, 'left'
  ) + 1;
  const sideDistance = baseSideDistance +
    (port.lane === 'leading' ? 1 : port.lane === 'trailing' ? -1 : 0);
  const members: IntentProgramLimbMember[] = [];
  for (const side of sides) {
    const growth = memberGrowthDirection(module.growth, side);
    const direction = localDirection(state.intent, growth);
    const normalDistance = Math.max(0,
      compilerPartDirectionalReach(state.intent, parentPart, growth) - 1
    );
    const lateral = side === 'left' ? sideDistance : -sideDistance;
    const partId = prefixed(`limb.${side}`, module.id);
    const slotId = prefixed(`slot.limb.${side}`, module.id);
    const start = addPoints(
      parentCenter,
      localPoint(state.intent, lateral + port.lateral, port.up, port.forward),
      scalePoint(direction, normalDistance)
    );
    const end = addPoints(
      start, scalePoint(direction, growth === 'down' ? 2 : 4)
    );
    state.addPart({
      partId,
      parentPartId: parent.partId,
      materialId: 'mat.base',
      joint: { kind: 'ball' },
      attachment: attachment(start),
      kind: 'segment',
      points: [start, end],
      radii: [localRadii(state.intent, 1, 1, 1), localRadii(state.intent, 1, 1, 1)],
      profile: 'balanced'
    });
    state.addSlot({
      slotId,
      structuralRole: moduleStructuralRole(module.kind),
      qualityStage: 'structure',
      partIds: [partId],
      parentSlotIds: [parent.slotId],
      spatialRelations: [bodyGrowthSpatialRelation(growth), ...sideRelation(side)],
      facing: null,
      symmetry: sides.length === 2
        ? sideSymmetry(pairId) : centeredOrAsymmetric(state.program),
      support: { kind: 'none' },
      span: { kind: 'none' }
    });
    members.push({ side, partId, slotId, endpoint: end });
  }
  if (module.cardinality === 'paired') {
    state.registerLimbPair({ moduleId: module.id, members });
  }
  state.addGraph({
    id: module.id,
    kind: 'limb',
    sourcePath: modulePath(module),
    parentId: module.parent,
    cardinality: module.cardinality
  });
};

const addWheel = (
  state: BodyEmissionPort,
  module: IntentProgramAttachedModule,
  parent: IntentProgramModuleHost
): void => {
  const sides: readonly Side[] = module.cardinality === 'paired'
    ? ['left', 'right']
    : [module.anchor === 'right' ? 'right' : 'left'];
  const pairId = prefixed('pair', module.id);
  const port = allocateBodyPort(state, module.id);
  const parentPart = state.part(parent.partId);
  const parentCenter = compilerPartCenter(
    parentPart, localPoint(state.intent, 0, 7, 0)
  );
  const frame = projectSpatialFrame(state.intent);
  const axis = frame.lateralAxis;
  const sideDistance = compilerPartDirectionalReach(
    state.intent, parentPart, 'left'
  ) + 1;
  const rolling = state.compilation.support.kind === 'wheels' &&
    state.compilation.support.moduleIds.includes(module.id);
  const verticalDrop = rolling
    ? parentCenter[1] - 3
    : compilerPartDirectionalReach(state.intent, parentPart, 'down') + 1;
  const members: IntentProgramWheelMember[] = [];
  for (const side of sides) {
    const growth = memberGrowthDirection(module.growth, side);
    const lateral = frame.lateralSign === 1
      ? side === 'left' ? sideDistance : -sideDistance + 1
      : side === 'left' ? sideDistance - 1 : -sideDistance;
    const partId = prefixed(`wheel.${side}`, module.id);
    const slotId = prefixed(`slot.wheel.${side}`, module.id);
    const center = addPoints(parentCenter, localPoint(
      state.intent,
      lateral + port.lateral,
      port.up - verticalDrop,
      port.forward
    ));
    state.addPart({
      partId,
      parentPartId: parent.partId,
      materialId: 'mat.dark',
      joint: { kind: 'hinge', axis },
      attachment: attachment(center),
      kind: 'radial',
      axis,
      center,
      outerRadius: rolling ? 3 : 2,
      innerRadius: 1,
      depth: 1
    });
    state.addSlot({
      slotId,
      structuralRole: moduleStructuralRole(module.kind),
      qualityStage: 'structure',
      partIds: [partId],
      parentSlotIds: [parent.slotId],
      spatialRelations: [bodyGrowthSpatialRelation(growth), ...sideRelation(side)],
      facing: null,
      symmetry: sides.length === 2
        ? sideSymmetry(pairId) : centeredOrAsymmetric(state.program),
      support: { kind: 'none' },
      span: { kind: 'none' }
    });
    members.push({ side, partId, slotId });
  }
  if (module.cardinality === 'paired') {
    state.registerWheelPair({ moduleId: module.id, members });
  }
  state.addGraph({
    id: module.id,
    kind: 'wheel',
    sourcePath: modulePath(module),
    parentId: module.parent,
    cardinality: module.cardinality
  });
};

export const addAppendageBodyModule = (
  state: BodyEmissionPort,
  module: IntentProgramAttachedModule,
  parent: IntentProgramModuleHost
): boolean => {
  if (module.kind === 'limb') addLimb(state, module, parent);
  else if (module.kind === 'wheel') addWheel(state, module, parent);
  else return false;
  return true;
};
