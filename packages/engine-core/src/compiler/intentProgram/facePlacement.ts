import type { ModelPartLatticeVec3 } from '../../model';
import { projectSpatialFrame } from '../../project/projectSpatialFrame';
import {
  addGraph,
  addSlot,
  attachment,
  centeredOrAsymmetric,
  compilerHostAnchor,
  compilerPartPlanarReach,
  localPoint,
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

const scalePoint = (
  point: ModelPartLatticeVec3,
  amount: number
): ModelPartLatticeVec3 => [
  point[0] * amount,
  point[1] * amount,
  point[2] * amount
];

const forwardDepth = (
  part: BuildState['parts'][number],
  forward: ModelPartLatticeVec3
): number => {
  const depth = (point: ModelPartLatticeVec3): number =>
    point[0] * forward[0] + point[1] * forward[1] + point[2] * forward[2];
  if (part.kind === 'segment') return Math.max(...part.points.map(depth));
  if (part.kind === 'mass' || part.kind === 'radial') return depth(part.center);
  if (part.kind === 'plate') return depth(part.origin);
  return Number.NEGATIVE_INFINITY;
};

export interface FaceHostPlacement {
  parent: IntentProgramModuleHost;
  center: ModelPartLatticeVec3;
  attachment: ModelPartLatticeVec3;
}

/** Reserves an anterior facial zone without letting unrelated spans consume it. */
export const placeFaceHost = (
  state: BuildState,
  host: IntentProgramModuleHost
): FaceHostPlacement => {
  const frame = projectSpatialFrame(state.intent);
  const parent = state.parts.find((part) => part.partId === host.partId);
  const parentOrigin = compilerHostAnchor(
    state.intent,
    parent,
    localPoint(state.intent, 0, 5, 0)
  );
  const parentReach = compilerPartPlanarReach(parent);
  let center = addPoints(
    parentOrigin,
    localPoint(state.intent, 0, 3, parentReach + 1)
  );
  let faceAttachment = addPoints(
    parentOrigin,
    localPoint(state.intent, 0, 1, parentReach)
  );
  let parentHost = host;
  const existingForwardDepth = Math.max(
    ...state.parts.map((part) => forwardDepth(part, frame.forward))
  );
  const faceDepth = center[0] * frame.forward[0] +
    center[1] * frame.forward[1] + center[2] * frame.forward[2];
  if (existingForwardDepth < faceDepth - 2) {
    return { parent: parentHost, center, attachment: faceAttachment };
  }
  center = addPoints(
    center,
    scalePoint(frame.forward, existingForwardDepth - faceDepth + 4)
  );
  const bridgePartId = 'face.bridge';
  const bridgeSlotId = 'slot.face.bridge';
  const bridgeStart = addPoints(
    parentOrigin,
    localPoint(state.intent, 0, 0, parentReach)
  );
  const bridgeEnd = addPoints(center, scalePoint(frame.forward, -2));
  state.parts.push({
    partId: bridgePartId,
    parentPartId: host.partId,
    materialId: 'mat.dark',
    joint: { kind: 'fixed' },
    attachment: attachment(bridgeStart),
    kind: 'segment',
    points: [bridgeStart, bridgeEnd],
    radii: [[1, 1, 1], [1, 1, 1]],
    profile: 'hard'
  });
  addSlot(state, {
    slotId: bridgeSlotId,
    structuralRole: 'axis',
    qualityStage: 'structure',
    partIds: [bridgePartId],
    parentSlotIds: [host.slotId],
    spatialRelations: ['front'],
    facing: 'forward',
    symmetry: centeredOrAsymmetric(state.program),
    support: { kind: 'none' },
    span: { kind: 'none' }
  });
  addGraph(state, {
    id: 'face.bridge',
    kind: 'chain',
    sourcePath: 'face',
    parentId: host.moduleId,
    configuration: 'single'
  });
  parentHost = {
    moduleId: 'face.bridge',
    partId: bridgePartId,
    slotId: bridgeSlotId
  };
  faceAttachment = bridgeEnd;
  return { parent: parentHost, center, attachment: faceAttachment };
};
