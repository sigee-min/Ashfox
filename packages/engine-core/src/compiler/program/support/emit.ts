import type { ModelPartLatticeVec3 } from '../../../model';
import { compareStableText } from '../../../stableOrder';
import type { SupportEmissionPort } from '../lower/context';
import type {
  IntentProgramLimbPair,
  IntentProgramModuleHost,
  IntentProgramWheelPair
} from '../lower/contract';
import {
  attachment,
  centeredOrAsymmetric,
  compilerPartCenter,
  compilerPartDirectionalReach,
  localDirection,
  localPoint,
  localRadii
} from '../lower/spatial';
import {
  supportFootSoleForwardRadius,
  supportLocalCoordinates,
  supportSemanticBounds
} from './envelope';

export { validateSupportEnvelope } from './envelope';

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


const withFootSupport = (
  state: SupportEmissionPort,
  limb: IntentProgramLimbPair,
  member: IntentProgramLimbPair['members'][number],
  partIds: readonly string[]
): void => {
  const current = state.slot(member.slotId);
  if (!current) throw new Error(`Missing declared limb slot ${member.slotId}.`);
  state.replaceSlot(member.slotId, {
    ...current,
    partIds: [...new Set(partIds)].sort(compareStableText),
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
        clawPartIds: partIds.includes(
          `support.foot.${limb.moduleId}.${member.side}.claw`
        ) ? [`support.foot.${limb.moduleId}.${member.side}.claw`] : []
      }]
    }
  });
};

/**
 * Attachment derivation is allowed to choose a seam anchor for the source
 * side only. Its counterpart must be derived by reflection, otherwise a
 * perfectly mirrored recipe can still acquire unequal pivots at a cuboid
 * corner. This records the actual paired module ownership rather than
 * attempting a second independent snap for the right side.
 */
const registerPairedSlotAttachments = (
  state: SupportEmissionPort,
  leftSlotId: string,
  rightSlotId: string
): void => {
  const left = state.slot(leftSlotId);
  const right = state.slot(rightSlotId);
  if (!left || !right) {
    throw new Error('Declared paired support topology lost one slot.');
  }
  const rightParts = new Set(right.partIds);
  for (const sourcePartId of left.partIds) {
    const reflectedPartId = sourcePartId.replace('.left.', '.right.');
    if (
      reflectedPartId === sourcePartId ||
      !state.hasPart(reflectedPartId) ||
      !rightParts.has(reflectedPartId)
    ) {
      continue;
    }
    state.addAttachmentReflection({ sourcePartId, reflectedPartId });
  }
};

/**
 * Promotes one explicitly declared paired limb module into the neutral feet
 * support.  It never invents fore/rear legs: each generated contact is a
 * descendant of the limb module selected by `support feet contacts <module>`.
 */
export const addFootSupports = (
  state: SupportEmissionPort,
  limb: IntentProgramLimbPair
): void => {
  if (state.program.support.kind !== 'feet') return;
  const bounds = supportSemanticBounds(state);
  const rootPart = state.rootPart();
  const rootCenter = rootPart
    ? supportLocalCoordinates(state, compilerPartCenter(rootPart, [0, 7, 0]))
    : [0, 7, 0] as const;
  for (const member of limb.members) {
    const [lateral, , forward] = supportLocalCoordinates(
      state,
      member.endpoint
    );
    // A compiler-owned sole grows only as far as needed to contain the core
    // and body center of mass, which preserves a stable two-contact stance
    // without creating hidden extra legs.
    const soleForwardRadius = supportFootSoleForwardRadius(
      state, bounds, rootCenter[2], forward
    );
    const supportIndex = state.compilation.support.kind === 'feet'
      ? state.compilation.support.moduleIds.indexOf(limb.moduleId)
      : 0;
    const supportCount = state.compilation.support.kind === 'feet'
      ? state.compilation.support.moduleIds.length
      : 1;
    // Adjacent feet are close enough that their required forward-facing digit
    // chains would overlap. Alternate a small mirrored lateral toe lane while
    // keeping the limb/sole contact itself directly below its host port.
    const laneLateral = supportCount > 1
      ? (supportIndex % 2 === 0 ? 2 : -2)
      : 0;
    const digitLateral = lateral +
      (member.side === 'left' ? laneLateral : -laneLateral);
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
      digitLateral,
      1,
      forward + soleForwardRadius - 1
    );
    const toeEnd = localPoint(
      state.intent,
      digitLateral,
      1,
      forward + soleForwardRadius + 1
    );
    const clawEnd = localPoint(
      state.intent,
      digitLateral,
      1,
      forward + soleForwardRadius + 2
    );
    const includeClaw = state.compilation.support.kind !== 'feet' ||
      state.compilation.support.moduleIds.length === 1;
    state.addParts(
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
      }
    );
    if (includeClaw) state.addParts({
      partId: clawId,
      parentPartId: toeId,
      materialId: 'mat.dark',
      joint: { kind: 'fixed' },
      attachment: attachment(toeEnd),
      kind: 'segment',
      points: [toeEnd, clawEnd],
      radii: [localRadii(state.intent, 1, 1, 1), localRadii(state.intent, 1, 1, 1)],
      profile: 'hard'
    });
    withFootSupport(state, limb, member, [
      member.partId,
      shinId,
      soleId,
      toeId,
      ...(includeClaw ? [clawId] : [])
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
  state: SupportEmissionPort,
  wheels: IntentProgramWheelPair
): void => {
  if (state.program.support.kind !== 'wheels') return;
  for (const member of wheels.members) {
    const current = state.slot(member.slotId);
    if (!current) throw new Error(`Missing declared wheel slot ${member.slotId}.`);
    state.replaceSlot(member.slotId, {
      ...current,
      support: {
        kind: 'wheel',
        contact: 'grounded',
        wheelPartIds: [member.partId]
      }
    });
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
  state: SupportEmissionPort,
  host: IntentProgramModuleHost
): void => {
  if (state.program.support.kind !== 'base') return;
  const bounds = supportSemanticBounds(state);
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
  const hostPart = state.part(host.partId);
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
  state.addParts({
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
  state.addParts({
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
  state.addSlot({
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
  state.addSlot({
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
