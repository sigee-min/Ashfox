import {
  type ProjectDocument,
  type ProjectForwardDirection,
  type ProjectGrounding,
  type ProjectIntent,
  type ProjectIntentSymmetryPair
} from '../model';
import {
  isPartId,
  PART_CONTRACT_LIMITS
} from '../modeling/partContract';
import { canonicalJsonString } from '../canonicalJson';
import { compareStableText } from '../stableOrder';

export const PROJECT_INTENT_LIMITS = Object.freeze({
  maxSubjectLength: 160,
  maxFeatureLength: 240,
  maxRequiredFeatures: 32,
  maxRequiredIds: 128,
  maxClipIdLength: 128,
  maxSymmetryPairs: 64
});

export interface ProjectIntentIssue {
  path: string;
  message: string;
  expected: string;
}

export type NormalizeProjectIntentResult =
  | {
      ok: true;
      intent: ProjectIntent;
    }
  | {
      ok: false;
      issues: readonly ProjectIntentIssue[];
    };

export type ReadProjectIntentResult =
  | {
      ok: true;
      intent: ProjectIntent | null;
    }
  | {
      ok: false;
      issues: readonly ProjectIntentIssue[];
    };

const FORWARD_DIRECTIONS =
  new Set<ProjectForwardDirection>([
    'north',
    'south',
    'east',
    'west'
  ]);
const GROUNDING_VALUES =
  new Set<ProjectGrounding>([
    'grounded',
    'airborne',
    'free'
  ]);
const SYMMETRY_AXES = new Set(['x', 'y', 'z']);
const INTENT_KEYS = new Set([
  'subject',
  'forward',
  'grounding',
  'requiredFeatures',
  'requiredPartIds',
  'requiredMaterialIds',
  'requiredClipIds',
  'symmetryPairs'
]);
const SYMMETRY_KEYS = new Set([
  'axis',
  'plane',
  'leftPartId',
  'rightPartId'
]);

const isRecord = (
  value: unknown
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value);

export const projectIntentsEqual = (
  left: ProjectIntent | undefined,
  right: ProjectIntent | undefined
): boolean =>
  canonicalJsonString(left) === canonicalJsonString(right);

const normalizedReviewText = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

const addIssue = (
  issues: ProjectIntentIssue[],
  path: string,
  message: string,
  expected: string
): void => {
  issues.push({ path, message, expected });
};

const parseText = (
  value: unknown,
  path: string,
  maxLength: number,
  issues: ProjectIntentIssue[]
): string | null => {
  if (typeof value !== 'string') {
    addIssue(issues, path, 'Expected text.', 'string');
    return null;
  }
  const normalized = normalizedReviewText(value);
  if (normalized.length === 0 || normalized.length > maxLength) {
    addIssue(
      issues,
      path,
      'Review text is empty or longer than allowed.',
      `1-${maxLength} normalized characters`
    );
    return null;
  }
  return normalized;
};

interface TextArrayOptions {
  maxItems: number;
  minItems?: number;
  maxItemLength: number;
  normalizeWhitespace: boolean;
  validate?: (value: string) => boolean;
  expectedItem: string;
}

const parseTextArray = (
  value: unknown,
  path: string,
  options: TextArrayOptions,
  issues: ProjectIntentIssue[]
): readonly string[] | null => {
  if (!Array.isArray(value)) {
    addIssue(issues, path, 'Expected an array.', 'string array');
    return null;
  }
  if (
    value.length < (options.minItems ?? 0) ||
    value.length > options.maxItems
  ) {
    addIssue(
      issues,
      path,
      'Array length is outside the allowed range.',
      `${options.minItems ?? 0}-${options.maxItems} items`
    );
    return null;
  }
  const parsed: string[] = [];
  value.forEach((entry, index) => {
    if (typeof entry !== 'string') {
      addIssue(
        issues,
        `${path}[${index}]`,
        'Expected text.',
        options.expectedItem
      );
      return;
    }
    const normalized = options.normalizeWhitespace
      ? normalizedReviewText(entry)
      : entry.trim();
    if (
      normalized.length === 0 ||
      normalized.length > options.maxItemLength ||
      (options.validate && !options.validate(normalized))
    ) {
      addIssue(
        issues,
        `${path}[${index}]`,
        'Value is empty or outside the required ID/text contract.',
        options.expectedItem
      );
      return;
    }
    parsed.push(normalized);
  });
  if (parsed.length !== value.length) return null;
  return [...new Set(parsed)].sort(compareStableText);
};

const parseSymmetryPairs = (
  value: unknown,
  issues: ProjectIntentIssue[]
): readonly ProjectIntentSymmetryPair[] | null => {
  const initialIssueCount = issues.length;
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    addIssue(
      issues,
      'symmetryPairs',
      'Expected an array.',
      'exact symmetry pair array'
    );
    return null;
  }
  if (value.length > PROJECT_INTENT_LIMITS.maxSymmetryPairs) {
    addIssue(
      issues,
      'symmetryPairs',
      'Too many exact symmetry pairs.',
      `at most ${PROJECT_INTENT_LIMITS.maxSymmetryPairs} pairs`
    );
    return null;
  }

  const pairs: ProjectIntentSymmetryPair[] = [];
  const unorderedPairs = new Set<string>();
  value.forEach((entry, index) => {
    const path = `symmetryPairs[${index}]`;
    if (!isRecord(entry)) {
      addIssue(issues, path, 'Expected an object.', 'symmetry pair');
      return;
    }
    const unknownKey = Object.keys(entry).find(
      (key) => !SYMMETRY_KEYS.has(key)
    );
    if (unknownKey) {
      addIssue(
        issues,
        `${path}.${unknownKey}`,
        'Unknown symmetry property.',
        'axis, plane, leftPartId, or rightPartId'
      );
      return;
    }
    const axis = entry.axis;
    const plane = entry.plane;
    const leftPartId =
      typeof entry.leftPartId === 'string'
        ? entry.leftPartId.trim()
        : null;
    const rightPartId =
      typeof entry.rightPartId === 'string'
        ? entry.rightPartId.trim()
        : null;
    if (
      typeof axis !== 'string' ||
      !SYMMETRY_AXES.has(axis)
    ) {
      addIssue(
        issues,
        `${path}.axis`,
        'Unknown reflection axis.',
        'x | y | z'
      );
      return;
    }
    if (
      typeof plane !== 'number' ||
      !Number.isFinite(plane) ||
      !Number.isSafeInteger(plane * 2) ||
      Math.abs(plane) >
        PART_CONTRACT_LIMITS.maxAbsoluteCoordinate
    ) {
      addIssue(
        issues,
        `${path}.plane`,
        'Reflection plane is not a safe lattice integer or half.',
        'finite lattice coordinate in 0.5 increments'
      );
      return;
    }
    if (!isPartId(leftPartId)) {
      addIssue(
        issues,
        `${path}.leftPartId`,
        'Left part ID is invalid.',
        'canonical part ID'
      );
      return;
    }
    if (!isPartId(rightPartId)) {
      addIssue(
        issues,
        `${path}.rightPartId`,
        'Right part ID is invalid.',
        'canonical part ID'
      );
      return;
    }
    if (leftPartId === rightPartId) {
      addIssue(
        issues,
        path,
        'A symmetry pair requires two different parts.',
        'different leftPartId and rightPartId'
      );
      return;
    }
    const [
      canonicalLeftPartId,
      canonicalRightPartId
    ] = [leftPartId, rightPartId].sort(compareStableText);
    const pairKey = [
      axis,
      plane === 0 ? 0 : plane,
      canonicalLeftPartId,
      canonicalRightPartId
    ].join('|');
    if (unorderedPairs.has(pairKey)) {
      addIssue(
        issues,
        path,
        'The same symmetry relationship appears more than once.',
        'unique part pair per axis and plane'
      );
      return;
    }
    unorderedPairs.add(pairKey);
    pairs.push({
      axis: axis as ProjectIntentSymmetryPair['axis'],
      plane: plane === 0 ? 0 : plane,
      leftPartId: canonicalLeftPartId,
      rightPartId: canonicalRightPartId
    });
  });
  if (issues.length > initialIssueCount) return null;
  return pairs.sort(
    (left, right) =>
      compareStableText(left.axis, right.axis) ||
      left.plane - right.plane ||
      compareStableText(left.leftPartId, right.leftPartId) ||
      compareStableText(left.rightPartId, right.rightPartId)
  );
};

export const normalizeProjectIntent = (
  value: unknown
): NormalizeProjectIntentResult => {
  const issues: ProjectIntentIssue[] = [];
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [{
        path: 'intent',
        message: 'Project intent must be an object.',
        expected: 'project intent object'
      }]
    };
  }
  const unknownKey = Object.keys(value).find(
    (key) => !INTENT_KEYS.has(key)
  );
  if (unknownKey) {
    addIssue(
      issues,
      unknownKey,
      'Unknown project intent property.',
      [...INTENT_KEYS].join(', ')
    );
  }

  const subject = parseText(
    value.subject,
    'subject',
    PROJECT_INTENT_LIMITS.maxSubjectLength,
    issues
  );
  const forward = value.forward;
  if (
    typeof forward !== 'string' ||
    !FORWARD_DIRECTIONS.has(forward as ProjectForwardDirection)
  ) {
    addIssue(
      issues,
      'forward',
      'Unknown forward direction.',
      'north | south | east | west'
    );
  }
  const grounding = value.grounding;
  if (
    typeof grounding !== 'string' ||
    !GROUNDING_VALUES.has(grounding as ProjectGrounding)
  ) {
    addIssue(
      issues,
      'grounding',
      'Unknown grounding mode.',
      'grounded | airborne | free'
    );
  }
  const requiredFeatures = parseTextArray(
    value.requiredFeatures,
    'requiredFeatures',
    {
      minItems: 1,
      maxItems: PROJECT_INTENT_LIMITS.maxRequiredFeatures,
      maxItemLength: PROJECT_INTENT_LIMITS.maxFeatureLength,
      normalizeWhitespace: true,
      expectedItem: 'short human/agent review criterion'
    },
    issues
  );
  const partIdOptions: TextArrayOptions = {
    maxItems: PROJECT_INTENT_LIMITS.maxRequiredIds,
    maxItemLength: PART_CONTRACT_LIMITS.maxIdLength,
    normalizeWhitespace: false,
    validate: isPartId,
    expectedItem: 'canonical part ID'
  };
  const requiredPartIds = parseTextArray(
    value.requiredPartIds,
    'requiredPartIds',
    partIdOptions,
    issues
  );
  const requiredMaterialIds = parseTextArray(
    value.requiredMaterialIds,
    'requiredMaterialIds',
    {
      ...partIdOptions,
      expectedItem: 'canonical material ID'
    },
    issues
  );
  const requiredClipIds = parseTextArray(
    value.requiredClipIds,
    'requiredClipIds',
    {
      maxItems: PROJECT_INTENT_LIMITS.maxRequiredIds,
      maxItemLength: PROJECT_INTENT_LIMITS.maxClipIdLength,
      normalizeWhitespace: false,
      expectedItem: 'non-empty clip ID'
    },
    issues
  );
  const symmetryPairs = parseSymmetryPairs(
    value.symmetryPairs,
    issues
  );

  if (
    issues.length > 0 ||
    subject === null ||
    requiredFeatures === null ||
    requiredPartIds === null ||
    requiredMaterialIds === null ||
    requiredClipIds === null ||
    symmetryPairs === null ||
    typeof forward !== 'string' ||
    !FORWARD_DIRECTIONS.has(forward as ProjectForwardDirection) ||
    typeof grounding !== 'string' ||
    !GROUNDING_VALUES.has(grounding as ProjectGrounding)
  ) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    intent: {
      subject,
      forward: forward as ProjectForwardDirection,
      grounding: grounding as ProjectGrounding,
      requiredFeatures,
      requiredPartIds,
      requiredMaterialIds,
      requiredClipIds,
      ...(symmetryPairs.length > 0 ? { symmetryPairs } : {})
    }
  };
};

export const readProjectIntent = (
  document: Pick<ProjectDocument, 'intent'>
): ReadProjectIntentResult => {
  if (document.intent === undefined) {
    return { ok: true, intent: null };
  }
  const normalized = normalizeProjectIntent(document.intent);
  if (!normalized.ok) return normalized;
  if (
    canonicalJsonString(document.intent) !==
    canonicalJsonString(normalized.intent)
  ) {
    return {
      ok: false,
      issues: [{
        path: 'intent',
        message:
          'Persisted project intent must use normalized text and stable ordering.',
        expected: 'normalized project intent'
      }]
    };
  }
  return normalized;
};
