import {
  parseFeature,
  parseMass,
  parsePlate,
  parseRadial,
  parseSegment
} from './kindValidators';
import {
  COMMON_PART_KEYS,
  PART_KIND_KEYS,
  PART_KINDS,
  addIssue,
  isRecord,
  parseCommon,
  parseEnum,
  rejectUnknownKeys
} from './parsePrimitives';
import { PART_CONTRACT_LIMITS } from './rules';
import type {
  ParsedPart,
  PartContractIssue,
  PartContractResult,
  PartSpec
} from './types';

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

const parsePart = (
  input: unknown,
  path: string,
  issues: PartContractIssue[]
): ParsedPart => {
  if (!isRecord(input)) {
    addIssue(issues, path, 'type', 'Expected a PartSpec object.');
    return { value: null, estimatedCells: 0 };
  }
  const kind = parseEnum(input.kind, PART_KINDS, `${path}.kind`, issues);
  if (kind === null) return { value: null, estimatedCells: 0 };
  rejectUnknownKeys(
    input,
    [...COMMON_PART_KEYS, ...PART_KIND_KEYS[kind]],
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

const validatePartGraph = (
  parsed: readonly ParsedPart[],
  partIndexes: ReadonlyMap<string, number>,
  issues: PartContractIssue[]
): void => {
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
  for (const partId of partIndexes.keys()) visit(partId, []);
};

const indexParsedParts = (
  parsed: readonly ParsedPart[],
  issues: PartContractIssue[]
): ReadonlyMap<string, number> => {
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
  return partIndexes;
};

export const normalizePartSpecs = (
  input: unknown,
  limits: {
    maxParts?: number;
    maxOccupancyCells?: number;
  } = {}
): PartContractResult<readonly PartSpec[]> => {
  const maxParts = limits.maxParts ?? PART_CONTRACT_LIMITS.maxPartsPerBatch;
  const maxOccupancyCells =
    limits.maxOccupancyCells ??
    PART_CONTRACT_LIMITS.maxOccupancyCellsPerBatch;
  if (!Array.isArray(input)) {
    return {
      ok: false,
      issues: [{
        path: '$',
        code: 'type',
        message: 'Expected an array of PartSpec objects.'
      }]
    };
  }
  if (input.length === 0 || input.length > maxParts) {
    return {
      ok: false,
      issues: [{
        path: '$',
        code: 'length',
        message: `Expected 1 through ${maxParts} parts.`
      }]
    };
  }

  const issues: PartContractIssue[] = [];
  const parsed = input.map((entry, index) =>
    parsePart(entry, `$[${index}]`, issues)
  );
  const partIndexes = indexParsedParts(parsed, issues);
  validatePartGraph(parsed, partIndexes, issues);

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
