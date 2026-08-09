import type { AuthoringSlotAssignment } from '../../../../authoring/contract';
import type { ModelPartLatticeVec3 } from '../../../../model';
import type { IntentProgramLoweringContext } from '../context';
import type { Side } from '../contract';
import type { IntentProgramPlannedSurface } from '../../contract';
import type { ProjectSpatialFrame } from '../../../../project/frame';
import {
  attachment,
  centeredOrAsymmetric,
  sideRelation,
  sideSymmetry
} from '../spatial';
import {
  defaultSurfaceTemplate,
  surfaceMaterialPolicy,
  type DefaultSurfaceTemplate,
  type SurfaceMaterialPolicy
} from './role';
import { addShapedSurfaceMember } from './custom';

type Surface = IntentProgramPlannedSurface;
type Plane = 'xy' | 'xz' | 'yz';
type Axis = 'x' | 'y' | 'z';

export interface SurfaceMembersContext {
  readonly state: IntentProgramLoweringContext;
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
  readonly outwardGrowth: boolean;
  readonly pairedNonLateral: boolean;
  readonly materials: SurfaceMaterialPolicy;
  readonly template: DefaultSurfaceTemplate;
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
  outwardGrowth,
  pairedNonLateral,
  materials,
  template
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
  const extension = surface.growth === 'outward'
    ? sideVector
    : surface.growth === 'left'
      ? frame.left
      : surface.growth === 'right'
        ? frame.right
        : surface.growth === 'up'
          ? frame.up
          : surface.growth === 'down'
            ? scalePoint(frame.up, -1)
          : surface.growth === 'forward'
            ? frame.forward
            : scalePoint(frame.forward, -1);
  const cross = outwardGrowth
    ? frame.up
    : surface.growth === 'up' || surface.growth === 'down'
      ? side === null ? frame.left : frame.forward
      : surface.cardinality === 'paired' ? frame.up : frame.left;
  const mountBase = addPoints(
    hostOrigin,
    side !== null && !outwardGrowth
      ? scalePoint(sideVector, Math.max(1, hostReach - 1))
      : [0, 0, 0]
  );
  const base = addPoints(
    mountBase,
    outwardGrowth ? scalePoint(frame.up, 2) : [0, 0, 0],
    scalePoint(cross, surface.portOffset)
  );
  const rootExtensionStart = radialHost && surface.growth === 'up'
    ? 0
    : hostReach;
  const plane = planeFor(extension, cross);
  const rootStart = addPoints(
    base,
    scalePoint(extension, rootExtensionStart)
  );
  const rootEnd = addPoints(
    base,
    scalePoint(extension, rootExtensionStart + template.rootLength)
  );
  const segmentRadius: ModelPartLatticeVec3 = [1, 1, 1];
  state.addParts({
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
  const horizontalExtension = surface.growth === 'forward' ||
    surface.growth === 'rearward';
  for (let index = 0; index < sparIds.length; index += 1) {
    // A standing asset cannot spend half of a horizontal span below its root:
    // the lower spar would compete with the feet for ground contact. Horizontal
    // surfaces therefore fan from the root outward and upward; bilateral
    // reflection remains a left/right operation and stays exact.
    const offset = horizontalExtension ? index : index === 0 ? -1 : 1;
    const sparStart = addPoints(
      rootEnd,
      scalePoint(cross, offset * template.sparSpread)
    );
    const sparEnd = addPoints(
      sparStart,
      scalePoint(extension, template.sparLength),
      scalePoint(cross, offset * template.sparSpread * 2)
    );
    sparStarts.push(sparStart);
    sparEnds.push(sparEnd);
    state.addParts({
      partId: sparIds[index],
      parentPartId: rootIds[0],
      materialId: materials.sparMaterialId,
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
  state.addParts({
    partId: membranePartIds[0],
    parentPartId: pairedNonLateral ? sparIds[0]! : rootIds[0],
    materialId: materials.membraneMaterialId,
    joint: { kind: 'fixed' },
    attachment: attachment(pairedNonLateral ? sparStarts[0]! : membraneOrigin),
    kind: 'plate',
    plane,
    origin: membraneOrigin,
    outline: plateOutlineThrough(plane, membraneOrigin, membraneVertices),
    thickness: 1
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
    slotId,
    structuralRole: 'span',
    qualityStage: 'structure',
    partIds: [...rootIds, ...sparIds, ...membranePartIds].sort(),
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
  const explicitSingleSide: Side | null = surface.cardinality === 'single' &&
    (surface.anchor === 'left' || surface.anchor === 'right')
    ? surface.anchor
    : null;
  const sides: readonly (Side | null)[] = surface.cardinality === 'paired'
    ? ['left', 'right']
    : [explicitSingleSide];
  const outwardGrowth = surface.growth === 'outward' ||
    surface.growth === 'left' ||
    surface.growth === 'right';
  const pairedNonLateral = surface.cardinality === 'paired' &&
    !outwardGrowth;
  const pairId = `pair.surface.${surface.id}`;
  const materials = surfaceMaterialPolicy(surface.role);
  const template = defaultSurfaceTemplate(surface.role);
  for (const side of sides) {
    if (surface.shape !== undefined) {
      addShapedSurfaceMember({
        ...context,
        surface: { ...surface, shape: surface.shape },
        side,
        pairId,
        outwardGrowth
      });
      continue;
    }
    addSurfaceMember({
      ...context,
      side,
      pairId,
      outwardGrowth,
      pairedNonLateral,
      materials,
      template
    });
  }
};
