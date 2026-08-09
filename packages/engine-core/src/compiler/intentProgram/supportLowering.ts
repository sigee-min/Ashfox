import type {
  ModelPartLatticeVec3,
  ModelPartSpec
} from '../../model';
import { projectSpatialFrame } from '../../project/projectSpatialFrame';
import {
  addSlot,
  attachment,
  centeredOrAsymmetric,
  compilerPartCenter,
  compilerPartDirectionalReach,
  localDirection,
  localPoint,
  localRadii,
  type IntentProgramLimbPair,
  type IntentProgramModuleHost,
  type IntentProgramWheelPair,
  type BuildState
} from './state';

interface SemanticBounds {
  minimumLateral: number;
  maximumLateral: number;
  minimumUp: number;
  maximumUp: number;
  minimumForward: number;
  maximumForward: number;
  centerLateral: number;
  centerForward: number;
}

interface WorldBounds {
  minimum: ModelPartLatticeVec3;
  maximum: ModelPartLatticeVec3;
}

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

const localCoordinates = (
  state: BuildState,
  point: ModelPartLatticeVec3
): readonly [number, number, number] => {
  const frame = projectSpatialFrame(state.intent);
  const dot = (axis: ModelPartLatticeVec3): number =>
    point[0] * axis[0] + point[1] * axis[1] + point[2] * axis[2];
  return [dot(frame.left), dot(frame.up), dot(frame.forward)];
};

const boundsForPart = (part: ModelPartSpec): WorldBounds | null => {
  if (part.kind === 'feature') return null;
  if (part.kind === 'mass') {
    return {
      minimum: [
        part.center[0] - part.radii[0],
        part.center[1] - part.radii[1],
        part.center[2] - part.radii[2]
      ],
      maximum: [
        part.center[0] + part.radii[0],
        part.center[1] + part.radii[1],
        part.center[2] + part.radii[2]
      ]
    };
  }
  if (part.kind === 'segment') {
    const minimum: [number, number, number] = [Infinity, Infinity, Infinity];
    const maximum: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    part.points.forEach((point, index) => {
      const radius = part.radii[index]!;
      for (let axis = 0; axis < 3; axis += 1) {
        minimum[axis] = Math.min(minimum[axis], point[axis] - radius[axis]);
        maximum[axis] = Math.max(maximum[axis], point[axis] + radius[axis]);
      }
    });
    return { minimum, maximum };
  }
  if (part.kind === 'radial') {
    const halfDepth = Math.ceil(part.depth / 2);
    const radii: ModelPartLatticeVec3 = [
      part.axis === 'x' ? halfDepth : part.outerRadius,
      part.axis === 'y' ? halfDepth : part.outerRadius,
      part.axis === 'z' ? halfDepth : part.outerRadius
    ];
    return {
      minimum: [
        part.center[0] - radii[0],
        part.center[1] - radii[1],
        part.center[2] - radii[2]
      ],
      maximum: [
        part.center[0] + radii[0],
        part.center[1] + radii[1],
        part.center[2] + radii[2]
      ]
    };
  }
  const worldPoints: ModelPartLatticeVec3[] = [];
  for (const outlinePoint of part.outline) {
    if (part.plane === 'xy') {
      worldPoints.push([
        part.origin[0] + outlinePoint[0],
        part.origin[1] + outlinePoint[1],
        part.origin[2]
      ]);
    } else if (part.plane === 'xz') {
      worldPoints.push([
        part.origin[0] + outlinePoint[0],
        part.origin[1],
        part.origin[2] + outlinePoint[1]
      ]);
    } else {
      worldPoints.push([
        part.origin[0],
        part.origin[1] + outlinePoint[0],
        part.origin[2] + outlinePoint[1]
      ]);
    }
  }
  if (worldPoints.length === 0) return null;
  const minimum: [number, number, number] = [Infinity, Infinity, Infinity];
  const maximum: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const point of worldPoints) {
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], point[axis]);
      maximum[axis] = Math.max(
        maximum[axis],
        point[axis] + (part.plane === 'xy' && axis === 2 ||
          part.plane === 'xz' && axis === 1 ||
          part.plane === 'yz' && axis === 0 ? part.thickness : 0)
      );
    }
  }
  return { minimum, maximum };
};

const semanticBounds = (state: BuildState): SemanticBounds => {
  let minimumLateral = Infinity;
  let maximumLateral = -Infinity;
  let minimumUp = Infinity;
  let maximumUp = -Infinity;
  let minimumForward = Infinity;
  let maximumForward = -Infinity;
  let totalWeight = 0;
  let weightedLateral = 0;
  let weightedForward = 0;
  for (const part of state.parts) {
    const bounds = boundsForPart(part);
    if (!bounds) continue;
    const corners: ModelPartLatticeVec3[] = [];
    for (const x of [bounds.minimum[0], bounds.maximum[0]]) {
      for (const y of [bounds.minimum[1], bounds.maximum[1]]) {
        for (const z of [bounds.minimum[2], bounds.maximum[2]]) {
          corners.push([x, y, z]);
        }
      }
    }
    for (const corner of corners) {
      const [lateral, up, forward] = localCoordinates(state, corner);
      minimumLateral = Math.min(minimumLateral, lateral);
      maximumLateral = Math.max(maximumLateral, lateral);
      minimumUp = Math.min(minimumUp, up);
      maximumUp = Math.max(maximumUp, up);
      minimumForward = Math.min(minimumForward, forward);
      maximumForward = Math.max(maximumForward, forward);
    }
    const center = compilerPartCenter(part, [0, 0, 0]);
    const [lateral, , forward] = localCoordinates(state, center);
    const weight = Math.max(
      1,
      (bounds.maximum[0] - bounds.minimum[0]) *
        (bounds.maximum[1] - bounds.minimum[1]) *
        (bounds.maximum[2] - bounds.minimum[2])
    );
    totalWeight += weight;
    weightedLateral += lateral * weight;
    weightedForward += forward * weight;
  }
  if (totalWeight === 0) {
    return {
      minimumLateral: -4,
      maximumLateral: 4,
      minimumUp: 4,
      maximumUp: 10,
      minimumForward: -4,
      maximumForward: 4,
      centerLateral: 0,
      centerForward: 0
    };
  }
  return {
    minimumLateral,
    maximumLateral,
    minimumUp,
    maximumUp,
    minimumForward,
    maximumForward,
    centerLateral: weightedLateral / totalWeight,
    centerForward: weightedForward / totalWeight
  };
};

const exactSlot = (
  state: BuildState,
  slotId: string
): number => state.slots.findIndex((slot) => slot.slotId === slotId);

const withFootSupport = (
  state: BuildState,
  limb: IntentProgramLimbPair,
  member: IntentProgramLimbPair['members'][number],
  partIds: readonly string[]
): void => {
  const index = exactSlot(state, member.slotId);
  const current = state.slots[index];
  if (!current) throw new Error(`Missing declared limb slot ${member.slotId}.`);
  state.slots[index] = {
    ...current,
    partIds: [...new Set(partIds)].sort((left, right) => left.localeCompare(right)),
    support: {
      kind: 'foot',
      contact: 'grounded',
      // The declared limb owns the body topology; this lower articulated
      // segment is the actual foot root. It lets rest-quality evaluate the
      // vertical lower-body chain without mistaking the core's lateral port
      // offset for a diagonal leg.
      rootPartId: `support.foot.${limb.moduleId}.${member.side}.shin`,
      solePartIds: [`support.foot.${limb.moduleId}.${member.side}.sole`],
      digits: [{
        digitId: 'digit.primary',
        toePartIds: [`support.foot.${limb.moduleId}.${member.side}.toe`],
        clawPartIds: [`support.foot.${limb.moduleId}.${member.side}.claw`]
      }]
    }
  };
  for (const partId of partIds) state.partSlot.set(partId, member.slotId);
};

/**
 * Attachment derivation is allowed to choose a seam anchor for the source
 * side only. Its counterpart must be derived by reflection, otherwise a
 * perfectly mirrored recipe can still acquire unequal pivots at a cuboid
 * corner. This records the actual paired module ownership rather than
 * attempting a second independent snap for the right side.
 */
const registerPairedSlotAttachments = (
  state: BuildState,
  leftSlotId: string,
  rightSlotId: string
): void => {
  const left = state.slots.find((slot) => slot.slotId === leftSlotId);
  const right = state.slots.find((slot) => slot.slotId === rightSlotId);
  if (!left || !right) {
    throw new Error('Declared paired support topology lost one slot.');
  }
  const known = new Set(state.parts.map((part) => part.partId));
  const rightParts = new Set(right.partIds);
  for (const sourcePartId of left.partIds) {
    const reflectedPartId = sourcePartId.replace('.left.', '.right.');
    if (
      reflectedPartId === sourcePartId ||
      !known.has(reflectedPartId) ||
      !rightParts.has(reflectedPartId)
    ) {
      continue;
    }
    if (!state.attachmentReflections.some((pair) =>
      pair.sourcePartId === sourcePartId &&
      pair.reflectedPartId === reflectedPartId
    )) {
      state.attachmentReflections.push({ sourcePartId, reflectedPartId });
    }
  }
};

/**
 * Promotes one explicitly declared paired limb module into the neutral feet
 * support.  It never invents fore/rear legs: each generated contact is a
 * descendant of the limb module selected by `rest neutral feet on <module>`.
 */
export const addFootSupports = (
  state: BuildState,
  limb: IntentProgramLimbPair
): void => {
  if (state.program.rest.kind !== 'feet') return;
  const bounds = semanticBounds(state);
  const rootPart = state.parts.find((part) => part.parentPartId === null);
  const rootCenter = rootPart
    ? localCoordinates(state, compilerPartCenter(rootPart, [0, 7, 0]))
    : [0, 7, 0] as const;
  for (const member of limb.members) {
    const [lateral, , forward] = localCoordinates(state, member.endpoint);
    const targetForward = Math.max(
      Math.abs(bounds.centerForward - forward),
      Math.abs(rootCenter[2] - forward),
      2
    );
    // A compiler-owned sole grows only as far as needed to contain the core
    // and body center of mass, which preserves a stable two-contact stance
    // without creating hidden extra legs.
    const soleForwardRadius = Math.ceil(targetForward) + 1;
    const prefix = `support.foot.${limb.moduleId}.${member.side}`;
    const shinId = `${prefix}.shin`;
    const soleId = `${prefix}.sole`;
    const toeId = `${prefix}.toe`;
    const clawId = `${prefix}.claw`;
    // A down limb terminates at y=3; its explicit foot-root shin descends
    // from 3→2, leaving the sole as the only support region that touches
    // lattice ground.
    const shinEnd = localPoint(state.intent, lateral, 2, forward);
    const soleCenter = localPoint(state.intent, lateral, 1, forward);
    const toeStart = localPoint(
      state.intent,
      lateral,
      1,
      forward + soleForwardRadius - 1
    );
    const toeEnd = localPoint(
      state.intent,
      lateral,
      1,
      forward + soleForwardRadius + 1
    );
    const clawEnd = localPoint(
      state.intent,
      lateral,
      1,
      forward + soleForwardRadius + 2
    );
    state.parts.push(
      {
        partId: shinId,
        parentPartId: member.partId,
        materialId: 'mat.base',
        joint: { kind: 'ball' },
        attachment: attachment(member.endpoint),
        kind: 'segment',
        points: [member.endpoint, shinEnd],
        radii: [localRadii(state.intent, 1, 1, 1), localRadii(state.intent, 1, 1, 1)],
        profile: 'balanced'
      },
      {
        partId: soleId,
        parentPartId: shinId,
        materialId: 'mat.base',
        joint: { kind: 'fixed' },
        attachment: attachment(soleCenter),
        kind: 'mass',
        center: soleCenter,
        radii: localRadii(state.intent, 1, 1, soleForwardRadius),
        profile: 'block'
      },
      {
        partId: toeId,
        parentPartId: soleId,
        materialId: 'mat.base',
        joint: { kind: 'fixed' },
        attachment: attachment(toeStart),
        kind: 'segment',
        points: [toeStart, toeEnd],
        radii: [localRadii(state.intent, 1, 1, 1), localRadii(state.intent, 1, 1, 1)],
        profile: 'balanced'
      },
      {
        partId: clawId,
        parentPartId: toeId,
        materialId: 'mat.dark',
        joint: { kind: 'fixed' },
        attachment: attachment(toeEnd),
        kind: 'segment',
        points: [toeEnd, clawEnd],
        radii: [localRadii(state.intent, 1, 1, 1), localRadii(state.intent, 1, 1, 1)],
        profile: 'hard'
      }
    );
    withFootSupport(state, limb, member, [
      member.partId,
      shinId,
      soleId,
      toeId,
      clawId
    ]);
  }
  const left = limb.members.find((member) => member.side === 'left');
  const right = limb.members.find((member) => member.side === 'right');
  if (!left || !right) {
    throw new Error(`Paired limb module "${limb.moduleId}" lost one side.`);
  }
  registerPairedSlotAttachments(state, left.slotId, right.slotId);
};

/**
 * Promotes the radial primitives of one explicitly declared paired wheel
 * module into the neutral rolling support. The slot already owns those parts;
 * this only seals their contact authority instead of inventing a plinth.
 */
export const addWheelSupports = (
  state: BuildState,
  wheels: IntentProgramWheelPair
): void => {
  if (state.program.rest.kind !== 'wheels') return;
  for (const member of wheels.members) {
    const index = exactSlot(state, member.slotId);
    const current = state.slots[index];
    if (!current) throw new Error(`Missing declared wheel slot ${member.slotId}.`);
    state.slots[index] = {
      ...current,
      support: {
        kind: 'wheel',
        contact: 'grounded',
        wheelPartIds: [member.partId]
      }
    };
  }
  const left = wheels.members.find((member) => member.side === 'left');
  const right = wheels.members.find((member) => member.side === 'right');
  if (!left || !right) {
    throw new Error(`Paired wheel module "${wheels.moduleId}" lost one side.`);
  }
  registerPairedSlotAttachments(state, left.slotId, right.slotId);
};

/**
 * Lowers a ground plinth from the completed body envelope, centered beneath
 * the compiler's uniform-volume center rather than a fixed 4×4 primitive.
 */
export const addBaseSupport = (
  state: BuildState,
  host: IntentProgramModuleHost
): void => {
  if (state.program.rest.kind !== 'base') return;
  const bounds = semanticBounds(state);
  const baseLateral = Math.round(bounds.centerLateral);
  const baseForward = Math.round(bounds.centerForward);
  const lateralRadius = Math.max(
    4,
    Math.ceil(Math.max(
      Math.abs(bounds.minimumLateral - baseLateral),
      Math.abs(bounds.maximumLateral - baseLateral)
    )) + 1
  );
  const forwardRadius = Math.max(
    4,
    Math.ceil(Math.max(
      Math.abs(bounds.minimumForward - baseForward),
      Math.abs(bounds.maximumForward - baseForward)
    )) + 1
  );
  const hostPart = state.parts.find((part) => part.partId === host.partId);
  const hostCenter = compilerPartCenter(hostPart, localPoint(state.intent, 0, 7, 0));
  const start = addPoints(
    hostCenter,
    scalePoint(
      localDirection(state.intent, 'down'),
      Math.max(1, compilerPartDirectionalReach(state.intent, hostPart, 'down') - 1)
    )
  );
  const baseCenter = localPoint(state.intent, baseLateral, 1, baseForward);
  const stemEnd = localPoint(state.intent, baseLateral, 2, baseForward);
  const stemId = `support.base.${host.moduleId}.stem`;
  const partId = `support.base.${host.moduleId}`;
  state.parts.push({
    partId: stemId,
    parentPartId: host.partId,
    materialId: 'mat.dark',
    joint: { kind: 'fixed' },
    attachment: attachment(start),
    kind: 'segment',
    points: [start, stemEnd],
    radii: [localRadii(state.intent, 1, 1, 1), localRadii(state.intent, 1, 1, 1)],
    profile: 'hard'
  });
  state.parts.push({
    partId,
    parentPartId: stemId,
    materialId: 'mat.dark',
    joint: { kind: 'fixed' },
    attachment: attachment(baseCenter),
    kind: 'mass',
    center: baseCenter,
    radii: localRadii(state.intent, lateralRadius, 1, forwardRadius),
    profile: 'block'
  });
  const stemSlotId = `slot.support.base.${host.moduleId}.stem`;
  addSlot(state, {
    slotId: stemSlotId,
    structuralRole: 'axis',
    qualityStage: 'structure',
    partIds: [stemId],
    parentSlotIds: [host.slotId],
    spatialRelations: ['below'],
    facing: null,
    symmetry: centeredOrAsymmetric(state.program),
    support: { kind: 'none' },
    span: { kind: 'none' }
  });
  addSlot(state, {
    slotId: `slot.support.base.${host.moduleId}`,
    structuralRole: 'core',
    qualityStage: 'structure',
    partIds: [partId],
    parentSlotIds: [stemSlotId],
    spatialRelations: ['below'],
    facing: null,
    symmetry: centeredOrAsymmetric(state.program),
    support: { kind: 'base', contact: 'grounded', supportPartIds: [partId] },
    span: { kind: 'none' }
  });
};
