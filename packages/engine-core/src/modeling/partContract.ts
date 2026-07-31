import {
  GENERATED_PART_PRIMITIVES,
  type GeneratedPartJoint,
  type GeneratedPartPrimitive,
  type ModelFeaturePartSpec,
  type ModelMassPartSpec,
  type ModelPartAttachment,
  type ModelPartFace,
  type ModelPartLatticeVec2,
  type ModelPartLatticeVec3,
  type ModelPartMaterial,
  type ModelPartProfile,
  type ModelPartSpec,
  type ModelPlatePartSpec,
  type ModelRadialPartSpec,
  type ModelSegmentPartSpec
} from '../model';
import type { Axis } from './types';

export const PART_PRIMITIVES = GENERATED_PART_PRIMITIVES;

export type PartPrimitive = GeneratedPartPrimitive;
export type LatticeCoordinate = number;
export type LatticeVec2 = ModelPartLatticeVec2;
export type LatticeVec3 = ModelPartLatticeVec3;
export type PartAxis = Axis;
export type PartFace = ModelPartFace;
export type PartProfile = ModelPartProfile;

export const PART_CONTRACT_LIMITS = Object.freeze({
  maxIdLength: 64,
  maxPartsPerBatch: 64,
  maxPartsPerDocument: 1_024,
  maxSegmentPoints: 8,
  maxAbsoluteCoordinate: 16_384,
  maxAxisSpan: 256,
  maxExtent: 128,
  maxRelief: 16,
  maxOccupancyCellsPerPart: 131_072,
  maxOccupancyCellsPerBatch: 524_288,
  maxOccupancyCellsPerDocument: 2_097_152
});

export type FixedPartJoint =
  Extract<GeneratedPartJoint, { kind: 'fixed' }>;
export type HingePartJoint =
  Extract<GeneratedPartJoint, { kind: 'hinge' }>;
export type BallPartJoint =
  Extract<GeneratedPartJoint, { kind: 'ball' }>;
export type PartJoint = GeneratedPartJoint;

export type PartAttachment = ModelPartAttachment;
export type MassPartSpec = ModelMassPartSpec;
export type SegmentPartSpec = ModelSegmentPartSpec;
export type PlatePartSpec = ModelPlatePartSpec;
export type RadialPartSpec = ModelRadialPartSpec;
export type FeaturePartSpec = ModelFeaturePartSpec;
export type PartSpec = ModelPartSpec;
export type PartMaterialDefinition = ModelPartMaterial;

export type PartContractIssueCode =
  | 'type'
  | 'required'
  | 'unknown-key'
  | 'enum'
  | 'id'
  | 'integer'
  | 'range'
  | 'length'
  | 'duplicate'
  | 'relationship'
  | 'geometry'
  | 'budget';

export interface PartContractIssue {
  path: string;
  code: PartContractIssueCode;
  message: string;
}

export type PartContractResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      issues: readonly PartContractIssue[];
    };

type UnknownRecord = Readonly<Record<string, unknown>>;

export const PART_ID_PATTERN_SOURCE =
  '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$';
const ID_PATTERN = new RegExp(PART_ID_PATTERN_SOURCE);
const BASE_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const AXES = ['x', 'y', 'z'] as const;
const FACES = ['north', 'south', 'east', 'west', 'up', 'down'] as const;
const PROFILES = ['soft', 'balanced', 'hard'] as const;
const PLANES = ['xy', 'xz', 'yz'] as const;
const COMMON_KEYS = [
  'kind',
  'partId',
  'parentPartId',
  'materialId',
  'joint',
  'attachment'
] as const;

export const isPartId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= PART_CONTRACT_LIMITS.maxIdLength &&
  ID_PATTERN.test(value);

export const isPartBaseColor = (value: unknown): value is string =>
  typeof value === 'string' && BASE_COLOR_PATTERN.test(value);

const PRIMITIVE_KEYS: Readonly<Record<PartPrimitive, readonly string[]>> = {
  mass: ['center', 'radii', 'profile'],
  segment: ['points', 'radii', 'profile'],
  plate: ['plane', 'origin', 'outline', 'thickness'],
  radial: ['axis', 'center', 'outerRadius', 'innerRadius', 'depth'],
  feature: ['face', 'anchor', 'size', 'relief']
};

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const addIssue = (
  issues: PartContractIssue[],
  path: string,
  code: PartContractIssueCode,
  message: string
): void => {
  issues.push({ path, code, message });
};

const rejectUnknownKeys = (
  value: UnknownRecord,
  allowed: readonly string[],
  path: string,
  issues: PartContractIssue[]
): void => {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      addIssue(
        issues,
        `${path}.${key}`,
        'unknown-key',
        'Property is not part of the PartSpec contract.'
      );
    }
  }
};

const parseEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
  issues: PartContractIssue[]
): T | null => {
  if (typeof value === 'string' && allowed.includes(value as T)) {
    return value as T;
  }
  addIssue(
    issues,
    path,
    'enum',
    `Expected one of: ${allowed.join(', ')}.`
  );
  return null;
};

const parseId = (
  value: unknown,
  path: string,
  issues: PartContractIssue[]
): string | null => {
  if (
    !isPartId(value)
  ) {
    addIssue(
      issues,
      path,
      'id',
      `Expected a lowercase stable ID using alphanumeric, ".", "_", or "-" characters up to ${PART_CONTRACT_LIMITS.maxIdLength} characters.`
    );
    return null;
  }
  return value;
};

const parseInteger = (
  value: unknown,
  path: string,
  issues: PartContractIssue[],
  minimum: number,
  maximum: number
): number | null => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    addIssue(
      issues,
      path,
      'integer',
      'Expected an integer lattice coordinate.'
    );
    return null;
  }
  if (value < minimum || value > maximum) {
    addIssue(
      issues,
      path,
      'range',
      `Expected a value from ${minimum} through ${maximum}.`
    );
    return null;
  }
  return value;
};

const parseCoordinate = (
  value: unknown,
  path: string,
  issues: PartContractIssue[]
): number | null =>
  parseInteger(
    value,
    path,
    issues,
    -PART_CONTRACT_LIMITS.maxAbsoluteCoordinate,
    PART_CONTRACT_LIMITS.maxAbsoluteCoordinate
  );

const parseExtent = (
  value: unknown,
  path: string,
  issues: PartContractIssue[]
): number | null =>
  parseInteger(
    value,
    path,
    issues,
    1,
    PART_CONTRACT_LIMITS.maxExtent
  );

const parseVec2 = (
  value: unknown,
  path: string,
  issues: PartContractIssue[],
  parseEntry: (
    entry: unknown,
    entryPath: string,
    entryIssues: PartContractIssue[]
  ) => number | null = parseCoordinate
): LatticeVec2 | null => {
  if (!Array.isArray(value)) {
    addIssue(issues, path, 'type', 'Expected a two-item array.');
    return null;
  }
  if (value.length !== 2) {
    addIssue(issues, path, 'length', 'Expected exactly two items.');
    return null;
  }
  const x = parseEntry(value[0], `${path}[0]`, issues);
  const y = parseEntry(value[1], `${path}[1]`, issues);
  return x === null || y === null ? null : [x, y];
};

const parseVec3 = (
  value: unknown,
  path: string,
  issues: PartContractIssue[],
  parseEntry: (
    entry: unknown,
    entryPath: string,
    entryIssues: PartContractIssue[]
  ) => number | null = parseCoordinate
): LatticeVec3 | null => {
  if (!Array.isArray(value)) {
    addIssue(issues, path, 'type', 'Expected a three-item array.');
    return null;
  }
  if (value.length !== 3) {
    addIssue(issues, path, 'length', 'Expected exactly three items.');
    return null;
  }
  const x = parseEntry(value[0], `${path}[0]`, issues);
  const y = parseEntry(value[1], `${path}[1]`, issues);
  const z = parseEntry(value[2], `${path}[2]`, issues);
  return x === null || y === null || z === null ? null : [x, y, z];
};

const parseJoint = (
  value: unknown,
  path: string,
  issues: PartContractIssue[]
): PartJoint | null => {
  if (value === undefined) {
    return { kind: 'fixed' };
  }
  if (!isRecord(value)) {
    addIssue(issues, path, 'type', 'Expected a joint object.');
    return null;
  }

  const kind = parseEnum(
    value.kind,
    ['fixed', 'hinge', 'ball'] as const,
    `${path}.kind`,
    issues
  );
  const allowed = kind === 'hinge' ? ['kind', 'axis'] : ['kind'];
  rejectUnknownKeys(value, allowed, path, issues);
  if (kind === null) return null;

  if (kind === 'hinge') {
    const axis = parseEnum(value.axis, AXES, `${path}.axis`, issues);
    return axis === null ? null : { kind, axis };
  }
  return { kind };
};

const parseAttachment = (
  value: unknown,
  path: string,
  issues: PartContractIssue[]
): PartAttachment | null => {
  if (!isRecord(value)) {
    addIssue(issues, path, 'type', 'Expected an attachment object.');
    return null;
  }
  rejectUnknownKeys(
    value,
    ['parentAnchor', 'partAnchor'],
    path,
    issues
  );
  if (!('parentAnchor' in value)) {
    addIssue(
      issues,
      `${path}.parentAnchor`,
      'required',
      'Parent anchor is required.'
    );
  }
  if (!('partAnchor' in value)) {
    addIssue(
      issues,
      `${path}.partAnchor`,
      'required',
      'Part anchor is required.'
    );
  }
  const parentAnchor =
    'parentAnchor' in value
      ? parseVec3(value.parentAnchor, `${path}.parentAnchor`, issues)
      : null;
  const partAnchor =
    'partAnchor' in value
      ? parseVec3(value.partAnchor, `${path}.partAnchor`, issues)
      : null;
  return parentAnchor === null || partAnchor === null
    ? null
    : { parentAnchor, partAnchor };
};

interface ParsedCommon {
  partId: string;
  parentPartId: string | null;
  materialId: string;
  joint: PartJoint;
  attachment: PartAttachment | null;
}

const parseCommon = (
  input: UnknownRecord,
  path: string,
  issues: PartContractIssue[]
): ParsedCommon | null => {
  const partId = parseId(input.partId, `${path}.partId`, issues);
  const materialId = parseId(input.materialId, `${path}.materialId`, issues);
  const hasParentField = 'parentPartId' in input;
  const hasParent =
    hasParentField && input.parentPartId !== null;
  const parentPartId =
    !hasParentField || !hasParent
      ? null
      : parseId(input.parentPartId, `${path}.parentPartId`, issues);
  const joint = parseJoint(input.joint, `${path}.joint`, issues);
  const hasAttachmentField = 'attachment' in input;
  const hasAttachment =
    hasAttachmentField && input.attachment !== null;
  const attachment =
    !hasAttachmentField || !hasAttachment
      ? null
      : parseAttachment(input.attachment, `${path}.attachment`, issues);

  if (partId !== null && parentPartId === partId) {
    addIssue(
      issues,
      `${path}.parentPartId`,
      'relationship',
      'A part cannot parent itself.'
    );
  }
  if (!hasParent && attachment !== null) {
    addIssue(
      issues,
      `${path}.attachment`,
      'relationship',
      'A root part cannot have a parent attachment.'
    );
  }
  if (!hasParent && joint !== null && joint.kind !== 'fixed') {
    addIssue(
      issues,
      `${path}.joint`,
      'relationship',
      'A root part must use a fixed joint.'
    );
  }
  if (hasParent && parentPartId !== null && !hasAttachment) {
    addIssue(
      issues,
      `${path}.attachment`,
      'required',
      'A child part requires parent and part anchors.'
    );
  }

  return partId === null ||
    materialId === null ||
    hasParent && parentPartId === null ||
    joint === null
    ? null
    : {
        partId,
        parentPartId,
        materialId,
        joint,
        attachment
      };
};

const parseProfile = (
  value: unknown,
  path: string,
  issues: PartContractIssue[]
): PartProfile | null =>
  value === undefined
    ? 'balanced'
    : parseEnum(value, PROFILES, path, issues);

const axisSpan = (minimum: number, maximum: number): number =>
  maximum - minimum;

const validateSpan = (
  span: number,
  path: string,
  issues: PartContractIssue[]
): void => {
  if (span > PART_CONTRACT_LIMITS.maxAxisSpan) {
    addIssue(
      issues,
      path,
      'range',
      `Axis span exceeds ${PART_CONTRACT_LIMITS.maxAxisSpan} lattice units.`
    );
  }
};

const checkedProduct = (values: readonly number[]): number => {
  let product = 1;
  for (const value of values) {
    product *= Math.max(0, value);
    if (!Number.isSafeInteger(product)) return Number.POSITIVE_INFINITY;
  }
  return product;
};

const positiveOddSquaresAtMost = (limit: number): number => {
  if (limit < 1) return 0;
  let count = Math.floor((Math.sqrt(limit) + 1) / 2);
  while (count > 0 && (2 * count - 1) ** 2 > limit) {
    count -= 1;
  }
  while ((2 * count + 1) ** 2 <= limit) {
    count += 1;
  }
  return count;
};

const radialPlaneCellCount = (
  outerRadius: number,
  innerRadius: number
): number => {
  const outerSquared = (outerRadius * 2) ** 2;
  const innerSquared = (innerRadius * 2) ** 2;
  let cells = 0;
  for (
    let u = -outerRadius;
    u < outerRadius;
    u += 1
  ) {
    const doubledU = u * 2 + 1;
    const outerVCount =
      positiveOddSquaresAtMost(outerSquared - doubledU ** 2) * 2;
    const excludedInnerVCount =
      positiveOddSquaresAtMost(
        innerSquared - doubledU ** 2 - 1
      ) * 2;
    cells += outerVCount - excludedInnerVCount;
  }
  return cells;
};

const parseMass = (
  input: UnknownRecord,
  common: ParsedCommon,
  path: string,
  issues: PartContractIssue[]
): { value: MassPartSpec | null; estimatedCells: number } => {
  const center = parseVec3(input.center, `${path}.center`, issues);
  const radii = parseVec3(
    input.radii,
    `${path}.radii`,
    issues,
    parseExtent
  );
  const profile = parseProfile(input.profile, `${path}.profile`, issues);
  if (center === null || radii === null || profile === null) {
    return { value: null, estimatedCells: 0 };
  }
  for (let axis = 0; axis < 3; axis += 1) {
    validateSpan(radii[axis] * 2, `${path}.radii[${axis}]`, issues);
  }
  return {
    value: { ...common, kind: 'mass', center, radii, profile },
    estimatedCells: checkedProduct(
      radii.map((radius) => radius * 2)
    )
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

const parseSegment = (
  input: UnknownRecord,
  common: ParsedCommon,
  path: string,
  issues: PartContractIssue[]
): { value: SegmentPartSpec | null; estimatedCells: number } => {
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
      ...points.map(
        (point, index) => point[axis] - radii[index][axis]
      )
    )
  );
  const maximum = [0, 1, 2].map((axis) =>
    Math.max(
      ...points.map(
        (point, index) => point[axis] + radii[index][axis]
      )
    )
  );
  const spans = minimum.map((entry, axis) =>
    axisSpan(entry, maximum[axis])
  );
  spans.forEach((span, axis) =>
    validateSpan(span, `${path}.points.${'xyz'[axis]}Span`, issues)
  );

  return {
    value: { ...common, kind: 'segment', points, radii, profile },
    estimatedCells: checkedProduct(spans)
  };
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

const parsePlate = (
  input: UnknownRecord,
  common: ParsedCommon,
  path: string,
  issues: PartContractIssue[]
): { value: PlatePartSpec | null; estimatedCells: number } => {
  const plane = parseEnum(input.plane, PLANES, `${path}.plane`, issues);
  const origin = parseVec3(input.origin, `${path}.origin`, issues);
  const outline = parseOutline(input.outline, `${path}.outline`, issues);
  const thickness = parseExtent(
    input.thickness,
    `${path}.thickness`,
    issues
  );
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
  return {
    value: {
      ...common,
      kind: 'plate',
      plane,
      origin,
      outline,
      thickness
    },
    estimatedCells: checkedProduct([width, height, thickness])
  };
};

const parseRadial = (
  input: UnknownRecord,
  common: ParsedCommon,
  path: string,
  issues: PartContractIssue[]
): { value: RadialPartSpec | null; estimatedCells: number } => {
  const axis = parseEnum(input.axis, AXES, `${path}.axis`, issues);
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
  return {
    value:
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
        : null,
    estimatedCells: checkedProduct([
      radialPlaneCellCount(outerRadius, innerRadius),
      depth
    ])
  };
};

const parseFeature = (
  input: UnknownRecord,
  common: ParsedCommon,
  path: string,
  issues: PartContractIssue[]
): { value: FeaturePartSpec | null; estimatedCells: number } => {
  const face = parseEnum(input.face, FACES, `${path}.face`, issues);
  const anchor = parseVec3(input.anchor, `${path}.anchor`, issues);
  const size = parseVec2(input.size, `${path}.size`, issues, parseExtent);
  const relief =
    input.relief === undefined
      ? 1
      : parseInteger(
          input.relief,
          `${path}.relief`,
          issues,
          1,
          PART_CONTRACT_LIMITS.maxRelief
        );
  if (common.parentPartId === null) {
    addIssue(
      issues,
      `${path}.parentPartId`,
      'relationship',
      'A surface feature requires a parent part.'
    );
  }
  if (face === null || anchor === null || size === null || relief === null) {
    return { value: null, estimatedCells: 0 };
  }
  return {
    value:
      common.parentPartId === null
        ? null
        : { ...common, kind: 'feature', face, anchor, size, relief },
    estimatedCells: checkedProduct([
      size[0],
      size[1],
      relief
    ])
  };
};

const validatePartBudget = (
  estimatedCells: number,
  path: string,
  issues: PartContractIssue[]
): void => {
  if (estimatedCells > PART_CONTRACT_LIMITS.maxOccupancyCellsPerPart) {
    addIssue(
      issues,
      path,
      'budget',
      `Estimated occupancy exceeds ${PART_CONTRACT_LIMITS.maxOccupancyCellsPerPart} cells.`
    );
  }
};

interface ParsedPart {
  value: PartSpec | null;
  estimatedCells: number;
}

const parsePart = (
  input: unknown,
  path: string,
  issues: PartContractIssue[]
): ParsedPart => {
  if (!isRecord(input)) {
    addIssue(issues, path, 'type', 'Expected a PartSpec object.');
    return { value: null, estimatedCells: 0 };
  }
  const kind = parseEnum(input.kind, PART_PRIMITIVES, `${path}.kind`, issues);
  if (kind === null) return { value: null, estimatedCells: 0 };
  rejectUnknownKeys(
    input,
    [...COMMON_KEYS, ...PRIMITIVE_KEYS[kind]],
    path,
    issues
  );
  const common = parseCommon(input, path, issues);
  if (common === null) return { value: null, estimatedCells: 0 };

  let parsed: ParsedPart;
  switch (kind) {
    case 'mass':
      parsed = parseMass(input, common, path, issues);
      break;
    case 'segment':
      parsed = parseSegment(input, common, path, issues);
      break;
    case 'plate':
      parsed = parsePlate(input, common, path, issues);
      break;
    case 'radial':
      parsed = parseRadial(input, common, path, issues);
      break;
    case 'feature':
      parsed = parseFeature(input, common, path, issues);
      break;
  }
  validatePartBudget(parsed.estimatedCells, path, issues);
  return parsed;
};

export const normalizePartSpec = (
  input: unknown
): PartContractResult<PartSpec> => {
  const issues: PartContractIssue[] = [];
  const parsed = parsePart(input, '$', issues);
  return issues.length === 0 && parsed.value !== null
    ? { ok: true, value: parsed.value }
    : { ok: false, issues };
};

export const normalizePartSpecs = (
  input: unknown,
  limits: {
    maxParts?: number;
    maxOccupancyCells?: number;
  } = {}
): PartContractResult<readonly PartSpec[]> => {
  const issues: PartContractIssue[] = [];
  const maxParts =
    limits.maxParts ?? PART_CONTRACT_LIMITS.maxPartsPerBatch;
  const maxOccupancyCells =
    limits.maxOccupancyCells ??
    PART_CONTRACT_LIMITS.maxOccupancyCellsPerBatch;
  if (!Array.isArray(input)) {
    return {
      ok: false,
      issues: [
        {
          path: '$',
          code: 'type',
          message: 'Expected an array of PartSpec objects.'
        }
      ]
    };
  }
  if (
    input.length === 0 ||
    input.length > maxParts
  ) {
    return {
      ok: false,
      issues: [
        {
          path: '$',
          code: 'length',
          message: `Expected 1 through ${maxParts} parts.`
        }
      ]
    };
  }

  const parsed = input.map((entry, index) =>
    parsePart(entry, `$[${index}]`, issues)
  );
  const partIndexes = new Map<string, number>();
  for (let index = 0; index < parsed.length; index += 1) {
    const part = parsed[index].value;
    if (part === null) continue;
    const previous = partIndexes.get(part.partId);
    if (previous !== undefined) {
      addIssue(
        issues,
        `$[${index}].partId`,
        'duplicate',
        `Part ID duplicates $[${previous}].partId.`
      );
    } else {
      partIndexes.set(part.partId, index);
    }
  }

  const visitState = new Map<string, 'visiting' | 'visited'>();
  const visit = (partId: string, ancestry: readonly string[]): void => {
    const state = visitState.get(partId);
    if (state === 'visited') return;
    if (state === 'visiting') {
      const index = partIndexes.get(partId);
      addIssue(
        issues,
        index === undefined ? '$' : `$[${index}].parentPartId`,
        'relationship',
        `Part parent cycle detected: ${[...ancestry, partId].join(' -> ')}.`
      );
      return;
    }
    visitState.set(partId, 'visiting');
    const index = partIndexes.get(partId);
    const part = index === undefined ? null : parsed[index].value;
    if (
      part !== null &&
      part.parentPartId !== null &&
      partIndexes.has(part.parentPartId)
    ) {
      visit(part.parentPartId, [...ancestry, partId]);
    }
    visitState.set(partId, 'visited');
  };
  for (const partId of partIndexes.keys()) {
    visit(partId, []);
  }

  const estimatedCells = parsed.reduce(
    (total, part) => total + part.estimatedCells,
    0
  );
  if (estimatedCells > maxOccupancyCells) {
    addIssue(
      issues,
      '$',
      'budget',
      `Occupancy exceeds ${maxOccupancyCells} cells.`
    );
  }

  const values = parsed.map((entry) => entry.value);
  return issues.length === 0 && values.every((value) => value !== null)
    ? { ok: true, value: values as readonly PartSpec[] }
    : { ok: false, issues };
};
