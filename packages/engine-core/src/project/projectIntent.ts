import { canonicalJsonString } from '../canonicalJson';
import type {
  ProjectDocument,
  ProjectForwardDirection,
  ProjectGrounding,
  ProjectIntent,
  ProjectReferenceKind,
  ProjectReferenceObservation
} from '../model';
import { compareStableText } from '../stableOrder';

export const PROJECT_INTENT_LIMITS = Object.freeze({
  maxSubjectLength: 160,
  maxFeatureLength: 240,
  maxFeatures: 32,
  maxReferences: 16,
  maxReferenceDescriptionLength: 480,
  maxReferenceCues: 16,
  maxReferenceCueLength: 240
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
  'features',
  'references'
]);
const REFERENCE_KEYS = new Set([
  'id',
  'kind',
  'description',
  'cues',
  'contentHash'
]);
const REFERENCE_KINDS = new Set<ProjectReferenceKind>([
  'image',
  'text',
  'model'
]);
export const PROJECT_REFERENCE_ID_PATTERN_SOURCE =
  '^[a-z][a-z0-9._-]{0,63}$';
const REFERENCE_ID_PATTERN = new RegExp(
  PROJECT_REFERENCE_ID_PATTERN_SOURCE
);

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

const normalizedReferenceCues = (
  value: unknown,
  path: string,
  issues: ProjectIntentIssue[]
): readonly string[] | null => {
  if (
    !Array.isArray(value) ||
    value.length > PROJECT_INTENT_LIMITS.maxReferenceCues
  ) {
    issues.push({
      path,
      message: 'Reference cues must be a bounded array.',
      expected:
        `0-${PROJECT_INTENT_LIMITS.maxReferenceCues} concise strings`
    });
    return null;
  }
  const cues: string[] = [];
  value.forEach((entry, index) => {
    const cue = typeof entry === 'string' ? normalizedText(entry) : '';
    if (
      cue.length === 0 ||
      cue.length > PROJECT_INTENT_LIMITS.maxReferenceCueLength
    ) {
      issues.push({
        path: `${path}[${index}]`,
        message: 'Reference cue is empty or too long.',
        expected:
          `1-${PROJECT_INTENT_LIMITS.maxReferenceCueLength} normalized characters`
      });
      return;
    }
    cues.push(cue);
  });
  return [...new Set(cues)].sort(compareStableText);
};

const normalizedReferences = (
  value: unknown,
  issues: ProjectIntentIssue[]
): readonly ProjectReferenceObservation[] | null => {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > PROJECT_INTENT_LIMITS.maxReferences
  ) {
    issues.push({
      path: 'references',
      message: 'Reference observations must be a bounded array.',
      expected:
        `0-${PROJECT_INTENT_LIMITS.maxReferences} reference observations`
    });
    return null;
  }
  const references: ProjectReferenceObservation[] = [];
  const ids = new Set<string>();
  value.forEach((entry, index) => {
    const path = `references[${index}]`;
    if (!isRecord(entry)) {
      issues.push({
        path,
        message: 'Reference observation must be an object.',
        expected: '{id,kind,description,cues,contentHash?}'
      });
      return;
    }
    for (const key of Object.keys(entry)) {
      if (!REFERENCE_KEYS.has(key)) {
        issues.push({
          path: `${path}.${key}`,
          message: 'Unknown reference observation property.',
          expected: [...REFERENCE_KEYS].join(', ')
        });
      }
    }
    const id = typeof entry.id === 'string' ? entry.id : '';
    if (!REFERENCE_ID_PATTERN.test(id) || ids.has(id)) {
      issues.push({
        path: `${path}.id`,
        message: ids.has(id)
          ? 'Reference observation ID is duplicated.'
          : 'Reference observation ID is invalid.',
        expected: 'unique lowercase stable ID up to 64 characters'
      });
    }
    ids.add(id);
    const kind = entry.kind;
    if (
      typeof kind !== 'string' ||
      !REFERENCE_KINDS.has(kind as ProjectReferenceKind)
    ) {
      issues.push({
        path: `${path}.kind`,
        message: 'Reference observation kind is invalid.',
        expected: 'image | text | model'
      });
    }
    const description = typeof entry.description === 'string'
      ? normalizedText(entry.description)
      : '';
    if (
      description.length === 0 ||
      description.length >
        PROJECT_INTENT_LIMITS.maxReferenceDescriptionLength
    ) {
      issues.push({
        path: `${path}.description`,
        message: 'Reference description is empty or too long.',
        expected:
          `1-${PROJECT_INTENT_LIMITS.maxReferenceDescriptionLength} normalized characters`
      });
    }
    const cues = normalizedReferenceCues(
      entry.cues,
      `${path}.cues`,
      issues
    );
    const contentHash = entry.contentHash;
    if (
      contentHash !== undefined &&
      (
        typeof contentHash !== 'string' ||
        normalizedText(contentHash).length === 0 ||
        normalizedText(contentHash).length > 160
      )
    ) {
      issues.push({
        path: `${path}.contentHash`,
        message: 'Reference content hash is invalid.',
        expected: '1-160 normalized characters when provided'
      });
    }
    if (
      REFERENCE_ID_PATTERN.test(id) &&
      typeof kind === 'string' &&
      REFERENCE_KINDS.has(kind as ProjectReferenceKind) &&
      description.length > 0 &&
      description.length <=
        PROJECT_INTENT_LIMITS.maxReferenceDescriptionLength &&
      cues !== null
    ) {
      references.push({
        id,
        kind: kind as ProjectReferenceKind,
        description,
        cues,
        ...(typeof contentHash === 'string'
          ? { contentHash: normalizedText(contentHash) }
          : {})
      });
    }
  });
  return references.sort((left, right) => compareStableText(left.id, right.id));
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
  const references = normalizedReferences(value.references, issues);
  if (
    issues.length > 0 ||
    features === null ||
    references === null ||
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
        features,
        ...(references.length > 0 ? { references } : {})
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
