import type { CompiledPartState } from '../modeling/partInvariants';
import { cellKey, parseCellKey } from '../modeling/lattice';
import type { CellKey, LatticePoint } from '../modeling/types';
import {
  reflectProjectCell,
  type ProjectSpatialFrame
} from '../project/projectSpatialFrame';
import { compareStableText } from '../stableOrder';
import type { AuthoringSupport } from './authoringTypes';
import type {
  MutableSupportEvaluation,
  SupportQualityIssue,
  SupportQualityIssueCode,
  SupportQualityPoint,
  SupportRegionMetrics
} from './supportQualityTypes';

export const SUPPORT_QUALITY_EPSILON = 0.000001;

export const supportQualityIssue = (
  code: SupportQualityIssueCode,
  path: string,
  message: string,
  expected: string,
  partIds: readonly string[] = []
): SupportQualityIssue => ({
  code,
  path,
  message,
  expected,
  ...(partIds.length > 0
    ? { partIds: [...new Set(partIds)].sort(compareStableText) }
    : {})
});

export const addSupportQualityIssue = (
  evaluation: MutableSupportEvaluation,
  entry: SupportQualityIssue,
  violation: boolean
): void => {
  evaluation.issues.push(entry);
  if (violation) evaluation.violations.push(entry);
};

export const supportPartIds = (
  support: AuthoringSupport
): readonly string[] => {
  if (support.kind === 'none') return [];
  if (support.kind === 'base') return support.supportPartIds;
  if (support.kind === 'wheel') return support.wheelPartIds;
  return [
    support.rootPartId,
    ...support.solePartIds,
    ...support.digits.flatMap((digit) => [
      ...digit.toePartIds,
      ...digit.clawPartIds
    ])
  ];
};

export const duplicateValues = (
  values: readonly string[]
): readonly string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort(compareStableText);
};

export const cellsForParts = (
  partIds: readonly string[],
  parts: ReadonlyMap<string, CompiledPartState>
): ReadonlySet<CellKey> =>
  new Set(
    partIds.flatMap((partId) => [
      ...(parts.get(partId)?.occupancy.cells ?? [])
    ])
  );

const cellCenter = (cell: LatticePoint): SupportQualityPoint => [
  cell.x + 0.5,
  cell.y + 0.5,
  cell.z + 0.5
];

export const supportDot = (
  left: SupportQualityPoint,
  right: LatticePoint
): number =>
  left[0] * right.x + left[1] * right.y + left[2] * right.z;

export const supportRegionMetrics = (
  cells: ReadonlySet<CellKey>,
  forward: LatticePoint
): SupportRegionMetrics | null => {
  if (cells.size === 0) return null;
  const points = [...cells].map((key) => cellCenter(parseCellKey(key)));
  const sums = points.reduce(
    (current, point) => [
      current[0] + point[0],
      current[1] + point[1],
      current[2] + point[2]
    ] as SupportQualityPoint,
    [0, 0, 0] as SupportQualityPoint
  );
  return {
    centroid: [
      sums[0] / points.length,
      sums[1] / points.length,
      sums[2] / points.length
    ],
    maximumForward: Math.max(
      ...points.map((point) => supportDot(point, forward))
    )
  };
};

const translatedCellKey = (
  key: CellKey,
  by: LatticePoint
): CellKey => {
  const cell = parseCellKey(key);
  return cellKey({
    x: cell.x + by.x,
    y: cell.y + by.y,
    z: cell.z + by.z
  });
};

export const exposedCellCount = (
  cells: ReadonlySet<CellKey>,
  direction: LatticePoint,
  environment: ReadonlySet<CellKey>
): number => [...cells].filter(
  (key) => !environment.has(translatedCellKey(key, direction))
).length;

export const environmentWithout = (
  environment: ReadonlySet<CellKey>,
  removed: ReadonlySet<CellKey>
): ReadonlySet<CellKey> => {
  if (removed.size === 0) return environment;
  return new Set([...environment].filter((key) => !removed.has(key)));
};

export const isStrictDescendant = (
  partId: string,
  ancestorPartId: string,
  parts: ReadonlyMap<string, CompiledPartState>
): boolean => {
  const visited = new Set<string>();
  let parentPartId = parts.get(partId)?.parentPartId ?? null;
  while (parentPartId !== null && !visited.has(parentPartId)) {
    if (parentPartId === ancestorPartId) return true;
    visited.add(parentPartId);
    parentPartId = parts.get(parentPartId)?.parentPartId ?? null;
  }
  return false;
};

export const groundContactCellCount = (
  cells: ReadonlySet<CellKey>
): number => [...cells].filter((key) => parseCellKey(key).y === 0).length;

export const belowGroundCellCount = (
  cells: ReadonlySet<CellKey>
): number => [...cells].filter((key) => parseCellKey(key).y < 0).length;

export const exactProjectReflection = (
  source: ReadonlySet<CellKey>,
  target: ReadonlySet<CellKey>,
  frame: ProjectSpatialFrame
): boolean => {
  if (frame.planeTwice === null || source.size !== target.size) return false;
  return [...source].every((key) => {
    const cell = parseCellKey(key);
    const reflected = reflectProjectCell(
      [cell.x, cell.y, cell.z],
      frame
    );
    return target.has(cellKey({
      x: reflected[0],
      y: reflected[1],
      z: reflected[2]
    }));
  });
};

export const minimumMargin = (
  values: readonly number[]
): number | null => values.length === 0 ? null : Math.min(...values);
