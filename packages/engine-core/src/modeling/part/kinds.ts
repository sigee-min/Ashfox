import {
  PART_AXES,
  PLATE_PLANES,
  addIssue,
  axisSpan,
  checkedProduct,
  parseEnum,
  parseExtent,
  parseInteger,
  parseMassProfile,
  parseProfile,
  parseVec2,
  parseVec3,
  radialPlaneCellCount,
  validateSpan
} from './primitives';
import { PART_CONTRACT_LIMITS } from './rules';
import type {
  LatticeVec2,
  LatticeVec3,
  MassPartSpec,
  ParsedCommon,
  ParsedPart,
  PartContractIssue,
  PlatePartSpec,
  RadialPartSpec,
  SegmentPartSpec,
  UnknownRecord
} from './contract';

export const parseMass = (
  input: UnknownRecord,
  common: ParsedCommon,
  path: string,
  issues: PartContractIssue[]
): ParsedPart => {
  const center = parseVec3(input.center, `${path}.center`, issues);
  const radii = parseVec3(input.radii, `${path}.radii`, issues, parseExtent);
  const profile = parseMassProfile(input.profile, `${path}.profile`, issues);
  if (center === null || radii === null || profile === null) {
    return { value: null, estimatedCells: 0 };
  }
  for (let axis = 0; axis < 3; axis += 1) {
    validateSpan(radii[axis] * 2, `${path}.radii[${axis}]`, issues);
  }
  const value: MassPartSpec = {
    ...common,
    kind: 'mass',
    center,
    radii,
    profile
  };
  return {
    value,
    estimatedCells: checkedProduct(radii.map((radius) => radius * 2))
  };
};

const parsePointArray = (
  value: unknown,
  path: string,
  issues: PartContractIssue[]
): readonly LatticeVec3[] | null => {
  if (!Array.isArray(value)) {
    addIssue(issues, path, 'type', 'Expected an array of lattice points.');
    return null;
  }
  if (
    value.length < 2 ||
    value.length > PART_CONTRACT_LIMITS.maxSegmentPoints
  ) {
    addIssue(
      issues,
      path,
      'length',
      `Expected 2 through ${PART_CONTRACT_LIMITS.maxSegmentPoints} points.`
    );
    return null;
  }
  const points = value.map((entry, index) =>
    parseVec3(entry, `${path}[${index}]`, issues)
  );
  if (points.some((point) => point === null)) return null;
  return points as readonly LatticeVec3[];
};

const parseRadiiArray = (
  value: unknown,
  path: string,
  issues: PartContractIssue[]
): readonly LatticeVec3[] | null => {
  if (!Array.isArray(value)) {
    addIssue(issues, path, 'type', 'Expected an array of radius triples.');
    return null;
  }
  if (
    value.length < 2 ||
    value.length > PART_CONTRACT_LIMITS.maxSegmentPoints
  ) {
    addIssue(
      issues,
      path,
      'length',
      `Expected 2 through ${PART_CONTRACT_LIMITS.maxSegmentPoints} radius triples.`
    );
    return null;
  }
  const radii = value.map((entry, index) =>
    parseVec3(entry, `${path}[${index}]`, issues, parseExtent)
  );
  if (radii.some((radius) => radius === null)) return null;
  return radii as readonly LatticeVec3[];
};

const equalVec3 = (left: LatticeVec3, right: LatticeVec3): boolean =>
  left[0] === right[0] &&
  left[1] === right[1] &&
  left[2] === right[2];

export const parseSegment = (
  input: UnknownRecord,
  common: ParsedCommon,
  path: string,
  issues: PartContractIssue[]
): ParsedPart => {
  const points = parsePointArray(input.points, `${path}.points`, issues);
  const radii = parseRadiiArray(input.radii, `${path}.radii`, issues);
  const profile = parseProfile(input.profile, `${path}.profile`, issues);
  if (points === null || radii === null || profile === null) {
    return { value: null, estimatedCells: 0 };
  }
  if (radii.length !== points.length) {
    addIssue(
      issues,
      `${path}.radii`,
      'length',
      'Each segment point requires one radius triple.'
    );
    return { value: null, estimatedCells: 0 };
  }
  for (let index = 1; index < points.length; index += 1) {
    if (equalVec3(points[index - 1], points[index])) {
      addIssue(
        issues,
        `${path}.points[${index}]`,
        'geometry',
        'Adjacent segment points must be distinct.'
      );
    }
  }
  const minimum = [0, 1, 2].map((axis) =>
    Math.min(
      ...points.map((point, index) => point[axis] - radii[index][axis])
    )
  );
  const maximum = [0, 1, 2].map((axis) =>
    Math.max(
      ...points.map((point, index) => point[axis] + radii[index][axis])
    )
  );
  const spans = minimum.map((entry, axis) =>
    axisSpan(entry, maximum[axis])
  );
  spans.forEach((span, axis) =>
    validateSpan(span, `${path}.points.${'xyz'[axis]}Span`, issues)
  );
  const value: SegmentPartSpec = {
    ...common,
    kind: 'segment',
    points,
    radii,
    profile
  };
  return { value, estimatedCells: checkedProduct(spans) };
};

const signedAreaTwice = (outline: readonly LatticeVec2[]): number => {
  let area = 0;
  for (let index = 0; index < outline.length; index += 1) {
    const current = outline[index];
    const next = outline[(index + 1) % outline.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area;
};

const cross = (
  previous: LatticeVec2,
  current: LatticeVec2,
  next: LatticeVec2
): number =>
  (current[0] - previous[0]) * (next[1] - current[1]) -
  (current[1] - previous[1]) * (next[0] - current[0]);

const canonicalizeOutline = (
  outline: readonly LatticeVec2[]
): readonly LatticeVec2[] => {
  const counterClockwise =
    signedAreaTwice(outline) < 0 ? [...outline].reverse() : [...outline];
  let firstIndex = 0;
  for (let index = 1; index < counterClockwise.length; index += 1) {
    const candidate = counterClockwise[index];
    const first = counterClockwise[firstIndex];
    if (
      candidate[0] < first[0] ||
      candidate[0] === first[0] && candidate[1] < first[1]
    ) {
      firstIndex = index;
    }
  }
  return [
    ...counterClockwise.slice(firstIndex),
    ...counterClockwise.slice(0, firstIndex)
  ];
};

const hasParallelOppositeEdges = (
  outline: readonly LatticeVec2[]
): boolean => {
  if (outline.length !== 4) return true;
  const edges = outline.map((point, index) => {
    const next = outline[(index + 1) % outline.length];
    return [next[0] - point[0], next[1] - point[1]] as const;
  });
  const edgeCross = (left: LatticeVec2, right: LatticeVec2): number =>
    left[0] * right[1] - left[1] * right[0];
  return (
    edgeCross(edges[0], edges[2]) === 0 ||
    edgeCross(edges[1], edges[3]) === 0
  );
};

const parseOutline = (
  value: unknown,
  path: string,
  issues: PartContractIssue[]
): readonly LatticeVec2[] | null => {
  if (!Array.isArray(value)) {
    addIssue(issues, path, 'type', 'Expected a polygon outline.');
    return null;
  }
  if (value.length !== 3 && value.length !== 4) {
    addIssue(
      issues,
      path,
      'length',
      'A plate outline must contain three or four points.'
    );
    return null;
  }
  const parsed = value.map((point, index) =>
    parseVec2(point, `${path}[${index}]`, issues)
  );
  if (parsed.some((point) => point === null)) return null;
  const outline = parsed as readonly LatticeVec2[];
  const signatures = outline.map((point) => `${point[0]},${point[1]}`);
  if (new Set(signatures).size !== signatures.length) {
    addIssue(issues, path, 'duplicate', 'Plate points must be unique.');
    return null;
  }
  if (signedAreaTwice(outline) === 0) {
    addIssue(issues, path, 'geometry', 'Plate outline has zero area.');
    return null;
  }
  const turns = outline.map((point, index) =>
    cross(
      outline[(index + outline.length - 1) % outline.length],
      point,
      outline[(index + 1) % outline.length]
    )
  );
  if (
    turns.some((turn) => turn === 0) ||
    turns.some((turn) => Math.sign(turn) !== Math.sign(turns[0]))
  ) {
    addIssue(
      issues,
      path,
      'geometry',
      'Plate outline must be strictly convex.'
    );
    return null;
  }
  if (!hasParallelOppositeEdges(outline)) {
    addIssue(
      issues,
      path,
      'geometry',
      'A four-point plate must be a trapezoid or rectangle.'
    );
    return null;
  }
  return canonicalizeOutline(outline);
};

export const parsePlate = (
  input: UnknownRecord,
  common: ParsedCommon,
  path: string,
  issues: PartContractIssue[]
): ParsedPart => {
  const plane = parseEnum(input.plane, PLATE_PLANES, `${path}.plane`, issues);
  const origin = parseVec3(input.origin, `${path}.origin`, issues);
  const outline = parseOutline(input.outline, `${path}.outline`, issues);
  const thickness = parseExtent(input.thickness, `${path}.thickness`, issues);
  if (
    plane === null ||
    origin === null ||
    outline === null ||
    thickness === null
  ) {
    return { value: null, estimatedCells: 0 };
  }
  const xs = outline.map((point) => point[0]);
  const ys = outline.map((point) => point[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  validateSpan(width, `${path}.outline.xSpan`, issues);
  validateSpan(height, `${path}.outline.ySpan`, issues);
  const value: PlatePartSpec = {
    ...common,
    kind: 'plate',
    plane,
    origin,
    outline,
    thickness
  };
  return {
    value,
    estimatedCells: checkedProduct([width, height, thickness])
  };
};

export const parseRadial = (
  input: UnknownRecord,
  common: ParsedCommon,
  path: string,
  issues: PartContractIssue[]
): ParsedPart => {
  const axis = parseEnum(input.axis, PART_AXES, `${path}.axis`, issues);
  const center = parseVec3(input.center, `${path}.center`, issues);
  const outerRadius = parseExtent(
    input.outerRadius,
    `${path}.outerRadius`,
    issues
  );
  const innerRadius =
    input.innerRadius === undefined
      ? 0
      : parseInteger(
          input.innerRadius,
          `${path}.innerRadius`,
          issues,
          0,
          PART_CONTRACT_LIMITS.maxExtent - 1
        );
  const depth = parseExtent(input.depth, `${path}.depth`, issues);
  if (
    axis === null ||
    center === null ||
    outerRadius === null ||
    innerRadius === null ||
    depth === null
  ) {
    return { value: null, estimatedCells: 0 };
  }
  if (innerRadius >= outerRadius) {
    addIssue(
      issues,
      `${path}.innerRadius`,
      'geometry',
      'Inner radius must be smaller than outer radius.'
    );
  }
  validateSpan(outerRadius * 2, `${path}.outerRadius`, issues);
  const value: RadialPartSpec | null =
    innerRadius < outerRadius
      ? {
          ...common,
          kind: 'radial',
          axis,
          center,
          outerRadius,
          innerRadius,
          depth
        }
      : null;
  return {
    value,
    estimatedCells: checkedProduct([
      radialPlaneCellCount(outerRadius, innerRadius),
      depth
    ])
  };
};
