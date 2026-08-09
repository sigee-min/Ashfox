import type { ModelPartLatticeVec3 } from '../../../model';
import type { IntentProgramFocal } from '../../../project/program/types';
import type { IntentProgramLoweringContext } from '../lower/context';
import type { IntentProgramModuleHost } from '../lower/contract';
import {
  attachment,
  centeredOrAsymmetric,
  compilerHostAnchor,
  compilerPartPlanarReach,
  localPoint,
  localRadii
} from '../lower/spatial';

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

/**
 * A faceless hero asset still needs a readable focal stage. This cue is a
 * named source module on a declared host—not a label-driven face surrogate.
 */
export const addFocalCue = (
  state: IntentProgramLoweringContext,
  focal: IntentProgramFocal,
  host: IntentProgramModuleHost
): void => {
  const hostPart = state.part(host.partId);
  const origin = compilerHostAnchor(
    state.intent,
    hostPart,
    localPoint(state.intent, 0, 5, 0)
  );
  const reach = compilerPartPlanarReach(hostPart);
  const attachmentPoint = addPoints(
    origin,
    localPoint(state.intent, 0, 1, reach)
  );
  const center = addPoints(
    origin,
    localPoint(state.intent, 0, 2, reach + 1)
  );
  const partId = `focal.${focal.id}`;
  const slotId = `slot.focal.${focal.id}`;
  state.addParts({
    partId,
    parentPartId: host.partId,
    materialId: 'mat.accent',
    joint: { kind: 'fixed' },
    attachment: attachment(attachmentPoint),
    kind: 'mass',
    center,
    radii: localRadii(state.intent, 2, 2, 1),
    profile: 'hard'
  });
  state.addSlot({
    slotId,
    structuralRole: 'accent',
    qualityStage: 'focal',
    partIds: [partId],
    parentSlotIds: [host.slotId],
    spatialRelations: ['front'],
    facing: 'forward',
    symmetry: centeredOrAsymmetric(state.program),
    support: { kind: 'none' },
    span: { kind: 'none' }
  });
  state.addGraph({
    id: `focal.${focal.id}`,
    kind: 'focal',
    sourcePath: `focal.${focal.id}`,
    parentId: host.moduleId,
    cardinality: 'single'
  });
};
