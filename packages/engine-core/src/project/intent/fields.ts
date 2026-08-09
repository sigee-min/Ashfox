import type {
  ProjectForwardDirection,
  ProjectGrounding
} from '../../model';
import {
  PROJECT_FORWARD_DIRECTIONS,
  PROJECT_GROUNDING_VALUES,
  PROJECT_INTENT_LIMITS
} from './contract';
import { ProjectIntentIssueCollector } from './result';
import { normalizeIntentText, uniqueStableText } from './value';

const FORWARD_DIRECTIONS =
  new Set<ProjectForwardDirection>(PROJECT_FORWARD_DIRECTIONS);
const GROUNDING_VALUES =
  new Set<ProjectGrounding>(PROJECT_GROUNDING_VALUES);

export const normalizeIntentSubject = (
  value: unknown,
  issues: ProjectIntentIssueCollector
): string => {
  const subject = typeof value === 'string' ? normalizeIntentText(value) : '';
  if (
    subject.length === 0 ||
    subject.length > PROJECT_INTENT_LIMITS.maxSubjectLength
  ) {
    issues.add(
      'subject',
      'Subject is empty or too long.',
      `1-${PROJECT_INTENT_LIMITS.maxSubjectLength} normalized characters`
    );
  }
  return subject;
};

export const normalizeIntentForward = (
  value: unknown,
  issues: ProjectIntentIssueCollector
): ProjectForwardDirection | null => {
  if (
    typeof value === 'string' &&
    FORWARD_DIRECTIONS.has(value as ProjectForwardDirection)
  ) return value as ProjectForwardDirection;
  issues.add(
    'forward',
    'Unknown forward direction.',
    'north | south | east | west'
  );
  return null;
};

export const normalizeIntentGrounding = (
  value: unknown,
  issues: ProjectIntentIssueCollector
): ProjectGrounding | null => {
  if (
    typeof value === 'string' &&
    GROUNDING_VALUES.has(value as ProjectGrounding)
  ) return value as ProjectGrounding;
  issues.add(
    'grounding',
    'Unknown grounding mode.',
    'grounded | none | free-explicit'
  );
  return null;
};

export const normalizeIntentFeatures = (
  value: unknown,
  issues: ProjectIntentIssueCollector
): readonly string[] | null => {
  if (!Array.isArray(value)) {
    issues.add(
      'features',
      'Expected an array of concise visual criteria.',
      `0-${PROJECT_INTENT_LIMITS.maxFeatures} strings`
    );
    return null;
  }
  if (value.length > PROJECT_INTENT_LIMITS.maxFeatures) {
    issues.add(
      'features',
      'Too many visual criteria.',
      `at most ${PROJECT_INTENT_LIMITS.maxFeatures} strings`
    );
    return null;
  }
  const issueStart = issues.size;
  const features: string[] = [];
  value.forEach((entry, index) => {
    if (typeof entry !== 'string') {
      issues.addAt(
        'features',
        `[${index}]`,
        'Expected text.',
        'concise visual criterion'
      );
      return;
    }
    const feature = normalizeIntentText(entry);
    if (
      feature.length === 0 ||
      feature.length > PROJECT_INTENT_LIMITS.maxFeatureLength
    ) {
      issues.addAt(
        'features',
        `[${index}]`,
        'Visual criterion is empty or too long.',
        `1-${PROJECT_INTENT_LIMITS.maxFeatureLength} normalized characters`
      );
      return;
    }
    features.push(feature);
  });
  return issues.size === issueStart ? uniqueStableText(features) : null;
};
