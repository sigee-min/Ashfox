import type { ModelPartLatticeVec3 } from '../../model';
import { projectSpatialFrame } from '../../project/projectSpatialFrame';
import type { IntentProgramModule } from '../../project/intentProgramTypes';
import { moduleCapability } from './capabilities';
import {
  addGraph,
  addSlot,
  allocateBodyPort,
  attachment,
  bodyExtensionSpatialRelation,
  centeredOrAsymmetric,
  compilerPartCenter,
  compilerPartDirectionalReach,
  localDirection,
  localPoint,
  localRadii,
  type BodyExtension,
  type BuildState,
  type IntentProgramLimbMember,
  type IntentProgramModuleHost,
  type IntentProgramWheelMember,
  type Side,
  sideRelation,
  sideSymmetry
} from './state';

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
  state: BuildState,
  module: IntentProgramModule
): string => {
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
    radii: localRadii(state.intent, 4, 3, 4),
    profile: state.program.domain === 'organism' ? 'soft' : 'hard'
  });
  addSlot(state, {
    slotId,
    structuralRole: moduleCapability('core').structuralRole,
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

export const addRequiredCoreStructure = (
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
    radii: [localRadii(state.intent, 1, 1, 1), localRadii(state.intent, 1, 1, 1)],
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

const bodyExtension = (module: IntentProgramModule): BodyExtension => {
  if (module.kind === 'core' || module.extension === undefined) {
    throw new Error('Only a declared attached module can claim an exterior body port.');
  }
  return module.extension;
};

const axisFor = (point: ModelPartLatticeVec3): 'x' | 'y' | 'z' =>
  point[0] !== 0 ? 'x' : point[1] !== 0 ? 'y' : 'z';

const bodyPosition = (
  state: BuildState,
  module: IntentProgramModule,
  parent: IntentProgramModuleHost,
  childReach: number,
  paired: boolean
): { center: ModelPartLatticeVec3; extension: BodyExtension } => {
  const extension = bodyExtension(module);
  const port = allocateBodyPort(state, parent.moduleId, extension, paired);
  const parentPart = state.parts.find((part) => part.partId === parent.partId);
  const parentCenter = compilerPartCenter(
    parentPart,
    localPoint(state.intent, 0, 7, 0)
  );
  const center = addPoints(
    parentCenter,
    localPoint(state.intent, port.lateral, port.up, port.forward),
    scalePoint(
      localDirection(state.intent, extension),
      compilerPartDirectionalReach(state.intent, parentPart, extension) +
        childReach - 1
    )
  );
  return { center, extension };
};

const massReach = (extension: BodyExtension): number =>
  extension === 'up' || extension === 'down' ? 2 : 3;

const addMassLike = (
  state: BuildState,
  module: IntentProgramModule,
  parent: IntentProgramModuleHost
): IntentProgramModuleHost => {
  const partId = prefixed(module.kind, module.id);
  const slotId = prefixed('slot', module.id);
  const kind = module.kind === 'radial' ? 'radial' as const : 'mass' as const;
  const { center, extension } = bodyPosition(
    state,
    module,
    parent,
    kind === 'radial' ? 1 : massReach(bodyExtension(module)),
    false
  );
  state.parts.push(kind === 'radial'
    ? {
        partId,
        parentPartId: parent.partId,
        materialId: 'mat.base',
        joint: { kind: 'fixed' },
        attachment: attachment(center),
        kind,
        axis: axisFor(localDirection(state.intent, extension)),
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
  addSlot(state, {
    slotId,
    structuralRole: moduleCapability(module.kind).structuralRole,
    qualityStage: 'structure',
    partIds: [partId],
    parentSlotIds: [parent.slotId],
    spatialRelations: [bodyExtensionSpatialRelation(extension)],
    facing: null,
    symmetry: centeredOrAsymmetric(state.program),
    support: { kind: 'none' },
    span: { kind: 'none' }
  });
  addGraph(state, {
    id: module.id,
    kind: module.kind,
    sourcePath: modulePath(module),
    parentId: module.from ?? null,
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
  const extension = bodyExtension(module);
  const port = allocateBodyPort(state, parent.moduleId, extension, false);
  const parentPart = state.parts.find((part) => part.partId === parent.partId);
  const parentCenter = compilerPartCenter(
    parentPart,
    localPoint(state.intent, 0, 7, 0)
  );
  const direction = localDirection(state.intent, extension);
  const start = addPoints(
    parentCenter,
    localPoint(state.intent, port.lateral, port.up, port.forward),
    scalePoint(
      direction,
      Math.max(
        0,
        compilerPartDirectionalReach(state.intent, parentPart, extension) - 1
      )
    )
  );
  const end = addPoints(
    start,
    scalePoint(direction, extension === 'down' ? 3 : 4)
  );
  state.parts.push({
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
  addSlot(state, {
    slotId,
    structuralRole: moduleCapability(module.kind).structuralRole,
    qualityStage: 'structure',
    partIds: [partId],
    parentSlotIds: [parent.slotId],
    spatialRelations: [bodyExtensionSpatialRelation(extension)],
    facing: null,
    symmetry: centeredOrAsymmetric(state.program),
    support: { kind: 'none' },
    span: { kind: 'none' }
  });
  addGraph(state, {
    id: module.id,
    kind: 'chain',
    sourcePath: modulePath(module),
    parentId: module.from ?? null,
    configuration: 'single'
  });
  return { moduleId: module.id, partId, slotId };
};

const addLimb = (
  state: BuildState,
  module: IntentProgramModule,
  parent: IntentProgramModuleHost
): void => {
  const sides: readonly Side[] = module.configuration === 'paired'
    ? ['left', 'right']
    : ['left'];
  const pairId = prefixed('pair', module.id);
  const extension = bodyExtension(module);
  const port = allocateBodyPort(
    state,
    parent.moduleId,
    extension,
    module.configuration === 'paired'
  );
  const parentPart = state.parts.find((part) => part.partId === parent.partId);
  const parentCenter = compilerPartCenter(
    parentPart,
    localPoint(state.intent, 0, 7, 0)
  );
  const direction = localDirection(state.intent, extension);
  const normalDistance = Math.max(
    0,
    compilerPartDirectionalReach(state.intent, parentPart, extension) - 1
  );
  const sideDistance = compilerPartDirectionalReach(
    state.intent,
    parentPart,
    'left'
  ) + 1;
  const members: IntentProgramLimbMember[] = [];
  for (const side of sides) {
    const lateral = side === 'left' ? sideDistance : -sideDistance;
    const partId = prefixed(`limb.${side}`, module.id);
    const slotId = prefixed(`slot.limb.${side}`, module.id);
    const start = addPoints(
      parentCenter,
      localPoint(
        state.intent,
        lateral + port.lateral,
        port.up,
        port.forward
      ),
      scalePoint(direction, normalDistance)
    );
    const end = addPoints(
      start,
      scalePoint(direction, extension === 'down' ? 2 : 4)
    );
    state.parts.push({
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
    addSlot(state, {
      slotId,
      structuralRole: moduleCapability(module.kind).structuralRole,
      qualityStage: 'structure',
      partIds: [partId],
      parentSlotIds: [parent.slotId],
      spatialRelations: [
        bodyExtensionSpatialRelation(extension),
        ...sideRelation(side)
      ],
      facing: null,
      symmetry: sides.length === 2
        ? sideSymmetry(pairId)
        : centeredOrAsymmetric(state.program),
      support: { kind: 'none' },
      span: { kind: 'none' }
    });
    members.push({ side, partId, slotId, endpoint: end });
  }
  if (module.configuration === 'paired') {
    state.limbPairs.set(module.id, { moduleId: module.id, members });
  }
  addGraph(state, {
    id: module.id,
    kind: 'limb',
    sourcePath: modulePath(module),
    parentId: module.from ?? null,
    configuration: module.configuration ?? 'single'
  });
};

const addWheel = (
  state: BuildState,
  module: IntentProgramModule,
  parent: IntentProgramModuleHost
): void => {
  const sides: readonly Side[] = module.configuration === 'paired'
    ? ['left', 'right']
    : ['left'];
  const pairId = prefixed('pair', module.id);
  const extension = bodyExtension(module);
  const port = allocateBodyPort(
    state,
    parent.moduleId,
    extension,
    module.configuration === 'paired'
  );
  const parentPart = state.parts.find((part) => part.partId === parent.partId);
  const parentCenter = compilerPartCenter(
    parentPart,
    localPoint(state.intent, 0, 7, 0)
  );
  const frame = projectSpatialFrame(state.intent);
  const axis = frame.lateralAxis;
  const sideDistance = compilerPartDirectionalReach(
    state.intent,
    parentPart,
    'left'
  ) + 1;
  const rollingSupport = state.program.rest.kind === 'wheels' &&
    state.program.rest.on === module.id;
  const verticalDrop = rollingSupport
    ? parentCenter[1] - 3
    : extension === 'down'
      ? compilerPartDirectionalReach(state.intent, parentPart, 'down') + 1
      : 3;
  const members: IntentProgramWheelMember[] = [];
  for (const side of sides) {
    const lateral = frame.lateralSign === 1
      ? side === 'left' ? sideDistance : -sideDistance + 1
      : side === 'left' ? sideDistance - 1 : -sideDistance;
    const partId = prefixed(`wheel.${side}`, module.id);
    const slotId = prefixed(`slot.wheel.${side}`, module.id);
    const center = addPoints(
      parentCenter,
      localPoint(
        state.intent,
        lateral + port.lateral,
        port.up - verticalDrop,
        port.forward
      )
    );
    state.parts.push({
      partId,
      parentPartId: parent.partId,
      materialId: 'mat.dark',
      joint: { kind: 'hinge', axis },
      attachment: attachment(center),
      kind: 'radial',
      axis,
      center,
      outerRadius: rollingSupport ? 3 : 2,
      innerRadius: 1,
      depth: 1
    });
    addSlot(state, {
      slotId,
      structuralRole: moduleCapability(module.kind).structuralRole,
      qualityStage: 'structure',
      partIds: [partId],
      parentSlotIds: [parent.slotId],
      spatialRelations: [
        bodyExtensionSpatialRelation(extension),
        ...sideRelation(side)
      ],
      facing: null,
      symmetry: sides.length === 2
        ? sideSymmetry(pairId)
        : centeredOrAsymmetric(state.program),
      support: { kind: 'none' },
      span: { kind: 'none' }
    });
    members.push({ side, partId, slotId });
  }
  if (module.configuration === 'paired') {
    state.wheelPairs.set(module.id, { moduleId: module.id, members });
  }
  addGraph(state, {
    id: module.id,
    kind: 'wheel',
    sourcePath: modulePath(module),
    parentId: module.from ?? null,
    configuration: module.configuration ?? 'single'
  });
};

/** Lowers one non-core semantic body module after its host has resolved. */
export const addAttachedBodyModule = (
  state: BuildState,
  module: IntentProgramModule,
  parent: IntentProgramModuleHost
): IntentProgramModuleHost | null => {
  switch (module.kind) {
    case 'mass':
    case 'radial': return addMassLike(state, module, parent);
    case 'chain': return addChain(state, module, parent);
    case 'limb': addLimb(state, module, parent); return null;
    case 'wheel': addWheel(state, module, parent); return null;
    case 'core': return null;
  }
};
