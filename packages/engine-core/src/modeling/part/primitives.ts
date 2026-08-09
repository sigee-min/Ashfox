import {
  COMMON_PART_KEYS,
  EYE_GLYPHS,
  FEATURE_GLYPHS,
  FEATURE_MOTIFS,
  MOUTH_GLYPHS,
  NOSE_GLYPHS,
  PART_AXES,
  PART_CONTRACT_LIMITS,
  PART_FACES,
  PART_KIND_KEYS,
  PART_KINDS,
  MASS_PART_PROFILES,
  PART_PROFILES,
  PLATE_PLANES,
  isPartId
} from './rules';
import type {
  LatticeVec2,
  LatticeVec3,
  ParsedCommon,
  PartAttachment,
  PartContractIssue,
  PartContractIssueCode,
  PartJoint,
  MassPartProfile,
  PartProfile,
  UnknownRecord
} from './contract';

export {
  COMMON_PART_KEYS,
  EYE_GLYPHS,
  FEATURE_GLYPHS,
  FEATURE_MOTIFS,
  MOUTH_GLYPHS,
  NOSE_GLYPHS,
  PART_AXES,
  PART_FACES,
  PART_KIND_KEYS,
  PART_KINDS,
  PLATE_PLANES
};

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const addIssue = (
  issues: PartContractIssue[],
  path: string,
  code: PartContractIssueCode,
  message: string
): void => {
  issues.push({ path, code, message });
};

export const rejectUnknownKeys = (
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

export const parseEnum = <T extends string>(
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

export const parseId = (
  value: unknown,
  path: string,
  issues: PartContractIssue[]
): string | null => {
  if (!isPartId(value)) {
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

export const parseInteger = (
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

export const parseCoordinate = (
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

export const parseExtent = (
  value: unknown,
  path: string,
  issues: PartContractIssue[]
): number | null =>
  parseInteger(value, path, issues, 1, PART_CONTRACT_LIMITS.maxExtent);

export const parseVec2 = (
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

export const parseVec3 = (
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
  if (value === undefined) return { kind: 'fixed' };
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
    const axis = parseEnum(value.axis, PART_AXES, `${path}.axis`, issues);
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
  rejectUnknownKeys(value, ['parentAnchor', 'partAnchor'], path, issues);
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

export const parseCommon = (
  input: UnknownRecord,
  path: string,
  issues: PartContractIssue[]
): ParsedCommon | null => {
  const partId = parseId(input.partId, `${path}.partId`, issues);
  const materialId = parseId(input.materialId, `${path}.materialId`, issues);
  const hasParentField = 'parentPartId' in input;
  const hasParent = hasParentField && input.parentPartId !== null;
  const parentPartId =
    !hasParentField || !hasParent
      ? null
      : parseId(input.parentPartId, `${path}.parentPartId`, issues);
  const joint = parseJoint(input.joint, `${path}.joint`, issues);
  const hasAttachmentField = 'attachment' in input;
  const hasAttachment = hasAttachmentField && input.attachment !== null;
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
  return partId === null ||
    materialId === null ||
    hasParent && parentPartId === null ||
    joint === null
    ? null
    : { partId, parentPartId, materialId, joint, attachment };
};

export const parseProfile = (
  value: unknown,
  path: string,
  issues: PartContractIssue[]
): PartProfile | null =>
  value === undefined
    ? 'balanced'
    : parseEnum(value, PART_PROFILES, path, issues);

export const parseMassProfile = (
  value: unknown,
  path: string,
  issues: PartContractIssue[]
): MassPartProfile | null =>
  value === undefined
    ? 'balanced'
    : parseEnum(value, MASS_PART_PROFILES, path, issues);

export const axisSpan = (minimum: number, maximum: number): number =>
  maximum - minimum;

export const validateSpan = (
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

export const checkedProduct = (values: readonly number[]): number => {
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
  while (count > 0 && (2 * count - 1) ** 2 > limit) count -= 1;
  while ((2 * count + 1) ** 2 <= limit) count += 1;
  return count;
};

export const radialPlaneCellCount = (
  outerRadius: number,
  innerRadius: number
): number => {
  const outerSquared = (outerRadius * 2) ** 2;
  const innerSquared = (innerRadius * 2) ** 2;
  let cells = 0;
  for (let u = -outerRadius; u < outerRadius; u += 1) {
    const doubledU = u * 2 + 1;
    const outerVCount =
      positiveOddSquaresAtMost(outerSquared - doubledU ** 2) * 2;
    const excludedInnerVCount =
      positiveOddSquaresAtMost(innerSquared - doubledU ** 2 - 1) * 2;
    cells += outerVCount - excludedInnerVCount;
  }
  return cells;
};
