import type { AuthoringSlotAssignment } from '../../authoring/authoringTypes';
import type { ModelPartLatticeVec3 } from '../../model';
import type { IntentProgramIr } from '../../project/intentProgramTypes';
import type { ProjectSpatialFrame } from '../../project/projectSpatialFrame';
import {
  addSlot,
  attachment,
  centeredOrAsymmetric,
  sideRelation,
  sideSymmetry,
  type BuildState,
  type Side
} from './state';
import {
  surfaceRoleSpec,
  type SurfaceRoleSpec
} from './surfaceRoleSpec';

type Surface = IntentProgramIr['surfaces'][number];
type Plane = 'xy' | 'xz' | 'yz';
type Axis = 'x' | 'y' | 'z';

export interface SurfaceMembersContext {
  readonly state: BuildState;
  readonly surface: Surface;
  readonly rootPartId: string;
  readonly rootSlotId: string;
  readonly frame: ProjectSpatialFrame;
  readonly hostOrigin: ModelPartLatticeVec3;
  readonly hostReach: number;
  readonly radialHost: boolean;
}

interface SurfaceMemberContext extends SurfaceMembersContext {
  readonly side: Side | null;
  readonly pairId: string;
  readonly lateralExtension: boolean;
  readonly pairedNonLateral: boolean;
  readonly role: SurfaceRoleSpec;
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

const vectorAxis = (point: ModelPartLatticeVec3): Axis =>
  point[0] !== 0 ? 'x' : point[1] !== 0 ? 'y' : 'z';

const planeFor = (
  first: ModelPartLatticeVec3,
  second: ModelPartLatticeVec3
): Plane => {
  const axes = new Set([vectorAxis(first), vectorAxis(second)]);
  if (axes.has('x') && axes.has('y')) return 'xy';
  if (axes.has('x') && axes.has('z')) return 'xz';
  return 'yz';
};

const planeAxes = (plane: Plane): readonly [Axis, Axis] =>
  plane === 'xy' ? ['x', 'y'] : plane === 'xz' ? ['x', 'z'] : ['y', 'z'];

const axisValue = (point: ModelPartLatticeVec3, axis: Axis): number =>
  point[axis === 'x' ? 0 : axis === 'y' ? 1 : 2];

const plateOutlineThrough = (
  plane: Plane,
  origin: ModelPartLatticeVec3,
  vertices: readonly ModelPartLatticeVec3[]
): readonly [number, number][] => {
  const [u, v] = planeAxes(plane);
  return vertices.map((vertex) => [
    axisValue(vertex, u) - axisValue(origin, u),
    axisValue(vertex, v) - axisValue(origin, v)
  ]);
};

/**
 * Supported surfaces reserve one of two compiler-owned exterior ports on the
 * same host face. The source never supplies an offset; stable surface IDs
 * choose the port and validation rejects a third claimant before geometry is
 * emitted.
 */
const surfacePortOffset = (state: BuildState, surface: Surface): number => {
  const peers = state.program.surfaces
    .filter((candidate) =>
      candidate.from === surface.from &&
      candidate.extension === surface.extension
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  if (peers.length <= 1) return 0;
  const ordinal = peers.findIndex((candidate) => candidate.id === surface.id);
  return ordinal === 0 ? -2 : 2;
};

const addSurfaceMember = ({
  state,
  surface,
  rootPartId,
  rootSlotId,
  frame,
  hostOrigin,
  hostReach,
  radialHost,
  side,
  pairId,
  lateralExtension,
  pairedNonLateral,
  role
}: SurfaceMemberContext): void => {
  const member = side ?? 'center';
  const slotId = `slot.surface.${surface.id}.${member}`;
  const rootIds = [`surface.${surface.id}.${member}.root`];
  const sparIds = [
    `surface.${surface.id}.${member}.spar.1`,
    `surface.${surface.id}.${member}.spar.2`
  ];
  const membranePartIds = [`surface.${surface.id}.${member}.membrane`];
  const sideVector = side === 'right' ? frame.right : frame.left;
  const extension = surface.extension === 'lateral'
    ? sideVector
    : surface.extension === 'left'
      ? frame.left
      : surface.extension === 'right'
        ? frame.right
        : surface.extension === 'up'
          ? frame.up
          : surface.extension === 'forward'
            ? frame.forward
            : scalePoint(frame.forward, -1);
  const cross = lateralExtension
    ? frame.up
    : surface.extension === 'up'
      ? side === null ? frame.left : frame.forward
      : surface.configuration === 'paired' ? frame.up : frame.left;
  const mountBase = addPoints(
    hostOrigin,
    side !== null && !lateralExtension
      ? scalePoint(sideVector, Math.max(1, hostReach - 1))
      : [0, 0, 0]
  );
  const base = addPoints(
    mountBase,
    lateralExtension ? scalePoint(frame.up, 2) : [0, 0, 0],
    scalePoint(cross, surfacePortOffset(state, surface))
  );
  const rootExtensionStart = radialHost && surface.extension === 'up'
    ? 0
    : hostReach;
  const plane = planeFor(extension, cross);
  const rootStart = addPoints(
    base,
    scalePoint(extension, rootExtensionStart)
  );
  const rootEnd = addPoints(
    base,
    scalePoint(extension, rootExtensionStart + role.rootLength)
  );
  const segmentRadius: ModelPartLatticeVec3 = [1, 1, 1];
  state.parts.push({
    partId: rootIds[0],
    parentPartId: rootPartId,
    materialId: 'mat.base',
    joint: { kind: 'fixed' },
    attachment: attachment(rootStart),
    kind: 'segment',
    points: [rootStart, rootEnd],
    radii: [segmentRadius, segmentRadius],
    profile: 'hard'
  });
  const sparStarts: ModelPartLatticeVec3[] = [];
  const sparEnds: ModelPartLatticeVec3[] = [];
  const horizontalExtension = surface.extension === 'forward' ||
    surface.extension === 'rearward';
  for (let index = 0; index < sparIds.length; index += 1) {
    // A standing asset cannot spend half of a horizontal span below its root:
    // the lower spar would compete with the feet for ground contact. Horizontal
    // surfaces therefore fan from the root outward and upward; bilateral
    // reflection remains a left/right operation and stays exact.
    const offset = horizontalExtension ? index : index === 0 ? -1 : 1;
    const sparStart = addPoints(
      rootEnd,
      scalePoint(cross, offset * role.sparSpread)
    );
    const sparEnd = addPoints(
      sparStart,
      scalePoint(extension, role.sparLength),
      scalePoint(cross, offset * role.sparSpread * 2)
    );
    sparStarts.push(sparStart);
    sparEnds.push(sparEnd);
    state.parts.push({
      partId: sparIds[index],
      parentPartId: rootIds[0],
      materialId: role.sparMaterialId,
      joint: { kind: 'fixed' },
      attachment: attachment(sparStart),
      kind: 'segment',
      points: [sparStart, sparEnd],
      radii: [segmentRadius, segmentRadius],
      profile: 'hard'
    });
  }
  const lateralCoordinate = frame.lateralAxis === 'x'
    ? sideVector[0]
    : sideVector[2];
  const membraneOrigin = pairedNonLateral && side !== null
    ? addPoints(
        rootEnd,
        scalePoint(sideVector, lateralCoordinate > 0 ? 1 : 2)
      )
    : rootEnd;
  const membraneVertices = [
    sparStarts[0]!,
    sparStarts[1]!,
    sparEnds[1]!,
    sparEnds[0]!
  ];
  state.parts.push({
    partId: membranePartIds[0],
    parentPartId: pairedNonLateral ? sparIds[0]! : rootIds[0],
    materialId: role.membraneMaterialId,
    joint: { kind: 'fixed' },
    attachment: attachment(pairedNonLateral ? sparStarts[0]! : membraneOrigin),
    kind: 'plate',
    plane,
    origin: membraneOrigin,
    outline: plateOutlineThrough(plane, membraneOrigin, membraneVertices),
    thickness: 1
  });
  const directionalRelation: 'above' | 'front' | 'rear' | null =
    lateralExtension
      ? null
      : surface.extension === 'up' ? 'above'
        : surface.extension === 'forward' ? 'front' : 'rear';
  const spatialRelations: AuthoringSlotAssignment['spatialRelations'] = [
    ...(side === null ? [] : sideRelation(side)),
    ...(directionalRelation === null ? [] : [directionalRelation])
  ];
  addSlot(state, {
    slotId,
    structuralRole: 'span',
    qualityStage: 'structure',
    partIds: [...rootIds, ...sparIds, ...membranePartIds].sort(),
    parentSlotIds: [rootSlotId],
    spatialRelations,
    facing: null,
    symmetry: surface.configuration === 'paired'
      ? sideSymmetry(pairId)
      : centeredOrAsymmetric(state.program),
    support: { kind: 'none' },
    span: {
      kind: 'supported-surface',
      obligationId: surface.id,
      rootPartIds: rootIds,
      spars: sparIds.map((partId, index) => ({
        sparId: `spar.${index + 1}`,
        partIds: [partId]
      })),
      membranes: [{
        membraneId: 'membrane.main',
        partIds: membranePartIds,
        boundedBySparIds: ['spar.1', 'spar.2']
      }]
    }
  });
};

/** Emits deterministic member geometry for one semantic supported surface. */
export const addSurfaceMembers = (context: SurfaceMembersContext): void => {
  const { surface } = context;
  const explicitSingleSide: Side | null = surface.configuration === 'single' &&
    (surface.extension === 'left' || surface.extension === 'right')
    ? surface.extension
    : null;
  const sides: readonly (Side | null)[] = surface.configuration === 'paired'
    ? ['left', 'right']
    : [explicitSingleSide];
  const lateralExtension = surface.extension === 'lateral' ||
    surface.extension === 'left' ||
    surface.extension === 'right';
  const pairedNonLateral = surface.configuration === 'paired' &&
    !lateralExtension;
  const pairId = `pair.surface.${surface.id}`;
  const role = surfaceRoleSpec(surface.role);
  for (const side of sides) {
    addSurfaceMember({
      ...context,
      side,
      pairId,
      lateralExtension,
      pairedNonLateral,
      role
    });
  }
};
