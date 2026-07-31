import { canonicalJsonString } from '../canonicalJson';
import type {
  ProjectDocument,
  ProjectForwardDirection,
  ProjectGrounding,
  ProjectIntent
} from '../model';
import { compareStableText } from '../stableOrder';

export const PROJECT_INTENT_LIMITS = Object.freeze({
  maxSubjectLength: 160,
  maxFeatureLength: 240,
  maxFeatures: 32
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
const INTENT_KEYS = new Set([
  'subject',
  'forward',
  'grounding',
  'features'
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

const normalizedText = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

const normalizedFeatures = (
  value: unknown,
  issues: ProjectIntentIssue[]
): readonly string[] | null => {
  if (!Array.isArray(value)) {
    issues.push({
      path: 'features',
      message: 'Expected an array of concise visual criteria.',
      expected: `0-${PROJECT_INTENT_LIMITS.maxFeatures} strings`
    });
    return null;
  }
  if (value.length > PROJECT_INTENT_LIMITS.maxFeatures) {
    issues.push({
      path: 'features',
      message: 'Too many visual criteria.',
      expected: `at most ${PROJECT_INTENT_LIMITS.maxFeatures} strings`
    });
    return null;
  }
  const result: string[] = [];
  value.forEach((entry, index) => {
    if (typeof entry !== 'string') {
      issues.push({
        path: `features[${index}]`,
        message: 'Expected text.',
        expected: 'concise visual criterion'
      });
      return;
    }
    const feature = normalizedText(entry);
    if (
      feature.length === 0 ||
      feature.length > PROJECT_INTENT_LIMITS.maxFeatureLength
    ) {
      issues.push({
        path: `features[${index}]`,
        message: 'Visual criterion is empty or too long.',
        expected:
          `1-${PROJECT_INTENT_LIMITS.maxFeatureLength} normalized characters`
      });
      return;
    }
    result.push(feature);
  });
  if (issues.length > 0) return null;
  return [...new Set(result)].sort(compareStableText);
};

export const normalizeProjectIntent = (
  value: unknown
): NormalizeProjectIntentResult => {
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
  const issues: ProjectIntentIssue[] = [];
  for (const key of Object.keys(value)) {
    if (!INTENT_KEYS.has(key)) {
      issues.push({
        path: key,
        message: 'Unknown project intent property.',
        expected: [...INTENT_KEYS].join(', ')
      });
    }
  }

  const subject = typeof value.subject === 'string'
    ? normalizedText(value.subject)
    : '';
  if (
    subject.length === 0 ||
    subject.length > PROJECT_INTENT_LIMITS.maxSubjectLength
  ) {
    issues.push({
      path: 'subject',
      message: 'Subject is empty or too long.',
      expected:
        `1-${PROJECT_INTENT_LIMITS.maxSubjectLength} normalized characters`
    });
  }

  const forward = value.forward;
  if (
    typeof forward !== 'string' ||
    !FORWARD_DIRECTIONS.has(forward as ProjectForwardDirection)
  ) {
    issues.push({
      path: 'forward',
      message: 'Unknown forward direction.',
      expected: 'north | south | east | west'
    });
  }

  const grounding = value.grounding;
  if (
    typeof grounding !== 'string' ||
    !GROUNDING_VALUES.has(grounding as ProjectGrounding)
  ) {
    issues.push({
      path: 'grounding',
      message: 'Unknown grounding mode.',
      expected: 'grounded | airborne | free'
    });
  }

  const features = normalizedFeatures(value.features, issues);
  if (
    issues.length > 0 ||
    features === null ||
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
      features
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
