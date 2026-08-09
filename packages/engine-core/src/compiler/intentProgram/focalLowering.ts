import type { ModelPartLatticeVec3 } from '../../model';
import type { IntentProgramFocal } from '../../project/intentProgramTypes';
import {
  addGraph,
  addSlot,
  attachment,
  centeredOrAsymmetric,
  compilerHostAnchor,
  compilerPartPlanarReach,
  localPoint,
  localRadii,
  type BuildState,
  type IntentProgramModuleHost
} from './state';

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
  state: BuildState,
  focal: IntentProgramFocal,
  host: IntentProgramModuleHost
): void => {
  const hostPart = state.parts.find((part) => part.partId === host.partId);
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
  state.parts.push({
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
  addSlot(state, {
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
  addGraph(state, {
    id: `focal.${focal.id}`,
    kind: 'focal',
    sourcePath: `focal.${focal.id}`,
    parentId: host.moduleId,
    configuration: 'single'
  });
};
