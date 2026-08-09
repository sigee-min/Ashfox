import type {
  IntentProgramSurface,
  IntentProgramSurfaceChord,
  IntentProgramSurfaceEdge,
  IntentProgramSurfaceOffset,
  IntentProgramSurfaceSpan,
  IntentProgramSurfaceTip
} from '../../../../project/program/types';
import type {
  IntentProgramResolvedSurfaceShape,
  IntentProgramSurfaceMembrane,
  IntentProgramSurfacePoint,
  IntentProgramSurfaceStation
} from '../../contract';

const SPAN_LENGTH: Readonly<Record<IntentProgramSurfaceSpan, number>> = {
  short: 4,
  medium: 6,
  long: 8
};

const CHORD_HALF: Readonly<Record<IntentProgramSurfaceChord, number>> = {
  narrow: 2,
  medium: 3,
  broad: 4
};

const offsetDirection = (offset: IntentProgramSurfaceOffset): -1 | 0 | 1 => {
  switch (offset) {
    case 'center': return 0;
    case 'anterior':
    case 'dorsal':
    case 'distal': return 1;
    case 'posterior':
    case 'ventral':
    case 'medial': return -1;
  }
};

const tipHalfChord = (
  tip: IntentProgramSurfaceTip,
  chord: number
): number => {
  switch (tip) {
    case 'pointed': return 0;
    case 'rounded': return Math.max(1, chord - 1);
    case 'flat': return chord;
    case 'flared': return chord + 2;
    case 'forked': return chord + 1;
  }
};

const edgeHalfChord = (
  edge: IntentProgramSurfaceEdge,
  chord: number
): number => edge === 'convex'
  ? chord + 1
  : edge === 'concave' ? Math.max(1, chord - 1) : chord;

const station = (
  along: number,
  halfChord: number,
  spanLength: number,
  shift: -1 | 0 | 1
): IntentProgramSurfaceStation => Object.freeze({
  along,
  center: Math.round(shift * 2 * along / spanLength),
  halfChord
});

const uniqueStations = (
  entries: readonly IntentProgramSurfaceStation[]
): readonly IntentProgramSurfaceStation[] => {
  const byAlong = new Map<number, IntentProgramSurfaceStation>();
  for (const entry of entries) byAlong.set(entry.along, entry);
  return Object.freeze([...byAlong.values()].sort((left, right) =>
    left.along - right.along
  ));
};

const point = (along: number, cross: number): IntentProgramSurfacePoint =>
  Object.freeze({ along, cross });

const samePoint = (
  left: IntentProgramSurfacePoint,
  right: IntentProgramSurfacePoint
): boolean => left.along === right.along && left.cross === right.cross;

const uniquePoints = (
  points: readonly IntentProgramSurfacePoint[]
): readonly IntentProgramSurfacePoint[] => Object.freeze(points.filter(
  (entry, index) => points.findIndex((candidate) =>
    samePoint(candidate, entry)
  ) === index
));

const ordinaryOutline = (
  start: IntentProgramSurfaceStation,
  end: IntentProgramSurfaceStation
): readonly IntentProgramSurfacePoint[] => uniquePoints([
  point(start.along, start.center - start.halfChord),
  point(start.along, start.center + start.halfChord),
  point(end.along, end.center + end.halfChord),
  point(end.along, end.center - end.halfChord)
]);

const membraneTopology = (
  stations: readonly IntentProgramSurfaceStation[],
  fork: IntentProgramResolvedSurfaceShape['fork']
): readonly IntentProgramSurfaceMembrane[] => {
  const membranes: IntentProgramSurfaceMembrane[] = [];
  let parentId: string | undefined;
  const add = (
    outline: readonly IntentProgramSurfacePoint[],
    attachment: IntentProgramSurfacePoint,
    explicitParent: string | undefined = parentId
  ): string => {
    const id = `membrane.${membranes.length + 1}`;
    membranes.push(Object.freeze({
      id,
      outline,
      attachment,
      ...(explicitParent === undefined ? {} : { parentId: explicitParent })
    }));
    parentId = id;
    return id;
  };
  for (let index = 1; index < stations.length; index += 1) {
    const start = stations[index - 1];
    const end = stations[index];
    if (!start || !end) continue;
    if (fork && start.along === fork.notchAlong) {
      const sharedParent = parentId;
      const attachment = point(start.along, start.center);
      add(Object.freeze([
        point(start.along, start.center - start.halfChord),
        point(start.along, start.center),
        point(end.along, end.center - fork.notchHalfChord),
        point(end.along, end.center - end.halfChord)
      ]), attachment, sharedParent);
      add(Object.freeze([
        point(start.along, start.center),
        point(start.along, start.center + start.halfChord),
        point(end.along, end.center + end.halfChord),
        point(end.along, end.center + fork.notchHalfChord)
      ]), attachment, sharedParent);
      continue;
    }
    add(
      ordinaryOutline(start, end),
      point(start.along, start.center)
    );
  }
  return Object.freeze(membranes);
};

/** Resolves source semantics into a deeply immutable integer planform. */
export const resolveSurfaceShape = (
  surface: IntentProgramSurface
): IntentProgramResolvedSurfaceShape | undefined => {
  const shape = surface.shape;
  if (shape === undefined) return undefined;

  const spanLength = SPAN_LENGTH[shape.span];
  const chord = CHORD_HALF[shape.chord];
  const shift = offsetDirection(shape.offset);
  const midpoint = Math.floor(spanLength / 2);
  const notchAlong = spanLength - 2;
  const stations = uniqueStations([
    station(0, 1, spanLength, shift),
    station(1, chord, spanLength, shift),
    station(
      midpoint,
      edgeHalfChord(shape.edge, chord),
      spanLength,
      shift
    ),
    ...(shape.tip === 'forked'
      ? [station(notchAlong, chord, spanLength, shift)]
      : [station(spanLength - 1, chord, spanLength, shift)]),
    station(
      spanLength,
      tipHalfChord(shape.tip, chord),
      spanLength,
      shift
    )
  ]);
  const fork = shape.tip === 'forked'
    ? Object.freeze({ notchAlong, notchHalfChord: 1 })
    : undefined;
  const resolved: IntentProgramResolvedSurfaceShape = {
    axis: shape.axis,
    span: shape.span,
    chord: shape.chord,
    tip: shape.tip,
    offset: shape.offset,
    edge: shape.edge,
    rootLength: 1,
    spanLength,
    stations,
    membranes: membraneTopology(stations, fork),
    ...(fork === undefined ? {} : { fork })
  };
  return Object.freeze(resolved);
};
