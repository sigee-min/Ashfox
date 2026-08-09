import type { AuthoringSlotAssignment } from '../../../../authoring/contract';
import type { ModelPartLatticeVec3 } from '../../../../model';
import type { ProjectSpatialFrame } from '../../../../project/frame';
import type { IntentProgramLoweringContext } from '../context';
import type { Side } from '../contract';
import type {
  IntentProgramPlannedSurface,
  IntentProgramResolvedSurfaceShape,
  IntentProgramSurfacePoint,
  IntentProgramSurfaceStation
} from '../../contract';
import {
  attachment,
  centeredOrAsymmetric,
  sideRelation,
  sideSymmetry
} from '../spatial';
import { surfaceMaterialPolicy } from './role';

type Plane = 'xy' | 'xz' | 'yz';
type Axis = 'x' | 'y' | 'z';
type ShapedSurface = IntentProgramPlannedSurface & {
  readonly shape: IntentProgramResolvedSurfaceShape;
};

export interface ShapedSurfaceMemberContext {
  readonly state: IntentProgramLoweringContext;
  readonly surface: ShapedSurface;
  readonly rootPartId: string;
  readonly rootSlotId: string;
  readonly frame: ProjectSpatialFrame;
  readonly hostOrigin: ModelPartLatticeVec3;
  readonly hostReach: number;
  readonly radialHost: boolean;
  readonly side: Side | null;
  readonly pairId: string;
  readonly outwardGrowth: boolean;
}

const add = (
  ...points: readonly ModelPartLatticeVec3[]
): ModelPartLatticeVec3 => points.reduce<ModelPartLatticeVec3>(
  (total, point) => [
    total[0] + point[0],
    total[1] + point[1],
    total[2] + point[2]
  ],
  [0, 0, 0]
);

const scale = (
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

const planeNormal = (plane: Plane): Axis =>
  plane === 'xy' ? 'z' : plane === 'xz' ? 'y' : 'x';

const axisVector = (axis: Axis, amount: number): ModelPartLatticeVec3 =>
  axis === 'x' ? [amount, 0, 0]
    : axis === 'y' ? [0, amount, 0] : [0, 0, amount];

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

const growthVector = (
  surface: IntentProgramPlannedSurface,
  side: Side | null,
  frame: ProjectSpatialFrame
): ModelPartLatticeVec3 => {
  if (surface.growth === 'outward') {
    return side === 'right' ? frame.right : frame.left;
  }
  if (surface.growth === 'left') return frame.left;
  if (surface.growth === 'right') return frame.right;
  if (surface.growth === 'up') return frame.up;
  if (surface.growth === 'down') return scale(frame.up, -1);
  return surface.growth === 'forward'
    ? frame.forward
    : scale(frame.forward, -1);
};

const crossVector = (
  shape: IntentProgramResolvedSurfaceShape,
  side: Side | null,
  frame: ProjectSpatialFrame
): ModelPartLatticeVec3 => {
  if (shape.axis === 'vertical') return frame.up;
  if (shape.axis === 'longitudinal') return frame.forward;
  return side === 'right' ? frame.right : frame.left;
};

const planPoint = (
  origin: ModelPartLatticeVec3,
  extension: ModelPartLatticeVec3,
  cross: ModelPartLatticeVec3,
  station: IntentProgramSurfaceStation,
  side: -1 | 1
): ModelPartLatticeVec3 => add(
  origin,
  scale(extension, station.along),
  scale(cross, station.center + side * station.halfChord)
);

const surfacePoint = (
  origin: ModelPartLatticeVec3,
  extension: ModelPartLatticeVec3,
  cross: ModelPartLatticeVec3,
  point: IntentProgramSurfacePoint
): ModelPartLatticeVec3 => add(
  origin,
  scale(extension, point.along),
  scale(cross, point.cross)
);

/** Emits one shaped member without consulting raw source surfaces. */
export const addShapedSurfaceMember = ({
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
  outwardGrowth
}: ShapedSurfaceMemberContext): void => {
  const member = side ?? 'center';
  const prefix = `surface.${surface.id}.${member}`;
  const rootId = `${prefix}.root`;
  const sparIds = [`${prefix}.spar.1`, `${prefix}.spar.2`];
  const sideVector = side === 'right' ? frame.right : frame.left;
  const extension = growthVector(surface, side, frame);
  const cross = crossVector(surface.shape, side, frame);
  const mountBase = add(
    hostOrigin,
    side !== null && !outwardGrowth
      ? scale(sideVector, Math.max(1, hostReach - 1))
      : [0, 0, 0]
  );
  const base = add(
    mountBase,
    outwardGrowth ? scale(frame.up, 2) : [0, 0, 0],
    scale(cross, surface.portOffset)
  );
  const rootExtensionStart = radialHost && surface.growth === 'up'
    ? 0
    : hostReach;
  const rootStart = add(base, scale(extension, rootExtensionStart));
  const rootEnd = add(
    rootStart,
    scale(extension, surface.shape.rootLength)
  );
  const radius: ModelPartLatticeVec3 = [1, 1, 1];
  state.addParts({
    partId: rootId,
    parentPartId: rootPartId,
    materialId: 'mat.base',
    joint: { kind: 'fixed' },
    attachment: attachment(rootStart),
    kind: 'segment',
    points: [rootStart, rootEnd],
    radii: [radius, radius],
    profile: 'hard'
  });

  const materials = surfaceMaterialPolicy(surface.role);
  for (let index = 0; index < sparIds.length; index += 1) {
    const semanticSide = index === 0 ? -1 : 1;
    const points = surface.shape.stations.map((entry) =>
      planPoint(rootEnd, extension, cross, entry, semanticSide)
    );
    state.addParts({
      partId: sparIds[index]!,
      parentPartId: rootId,
      materialId: materials.sparMaterialId,
      joint: { kind: 'fixed' },
      attachment: attachment(points[0]!),
      kind: 'segment',
      points,
      radii: points.map(() => radius),
      profile: 'hard'
    });
  }

  const plane = planeFor(extension, cross);
  const lateralNormal = planeNormal(plane) === frame.lateralAxis;
  const centeredPlate = side === null &&
    state.program.symmetry === 'bilateral' &&
    lateralNormal;
  const sideNormalOffset = lateralNormal && side !== null &&
    axisValue(sideVector, frame.lateralAxis) < 0
    ? -1
    : 0;
  const membranePartIds = surface.shape.membranes.map((region) =>
    `${prefix}.${region.id}`
  );
  surface.shape.membranes.forEach((region, index) => {
    const attachmentPoint = surfacePoint(
      rootEnd,
      extension,
      cross,
      region.attachment
    );
    const origin = centeredPlate || sideNormalOffset !== 0
      ? add(
          attachmentPoint,
          axisVector(
            frame.lateralAxis,
            centeredPlate ? -1 : sideNormalOffset
          )
        )
      : attachmentPoint;
    const vertices = region.outline.map((point) => surfacePoint(
      rootEnd,
      extension,
      cross,
      point
    ));
    state.addParts({
      partId: membranePartIds[index]!,
      parentPartId: region.parentId === undefined
        ? rootId
        : `${prefix}.${region.parentId}`,
      materialId: materials.membraneMaterialId,
      joint: { kind: 'fixed' },
      attachment: attachment(attachmentPoint),
      kind: 'plate',
      plane,
      origin,
      outline: plateOutlineThrough(plane, origin, vertices),
      thickness: centeredPlate ? 2 : 1
    });
  });

  const directionalRelation: 'above' | 'below' | 'front' | 'rear' | null =
    outwardGrowth
      ? null
      : surface.growth === 'up' ? 'above'
        : surface.growth === 'down' ? 'below'
          : surface.growth === 'forward' ? 'front' : 'rear';
  const spatialRelations: AuthoringSlotAssignment['spatialRelations'] = [
    ...(side === null ? [] : sideRelation(side)),
    ...(directionalRelation === null ? [] : [directionalRelation])
  ];
  state.addSlot({
    slotId: `slot.surface.${surface.id}.${member}`,
    structuralRole: 'span',
    qualityStage: 'structure',
    partIds: [rootId, ...sparIds, ...membranePartIds].sort(),
    parentSlotIds: [rootSlotId],
    spatialRelations,
    facing: null,
    symmetry: surface.cardinality === 'paired'
      ? sideSymmetry(pairId)
      : centeredOrAsymmetric(state.program),
    support: { kind: 'none' },
    span: {
      kind: 'supported-surface',
      obligationId: surface.id,
      rootPartIds: [rootId],
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
