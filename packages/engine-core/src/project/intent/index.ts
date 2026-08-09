import type { ProjectDocument, ProjectIntent } from '../../model';
import { projectIntentsEqual } from './canonical';
import {
  PROJECT_INTENT_KEYS,
  PROJECT_INTENT_LIMITS,
  PROJECT_REFERENCE_ID_PATTERN_SOURCE
} from './contract';
import { normalizeIntentComposition } from './compose';
import {
  normalizeIntentFeatures,
  normalizeIntentForward,
  normalizeIntentGrounding,
  normalizeIntentSubject
} from './fields';
import { normalizeIntentReferences } from './reference';
import {
  ProjectIntentIssueCollector,
  type NormalizeProjectIntentResult,
  type ProjectIntentReader,
  type ReadProjectIntentResult
} from './result';
import { normalizeIntentSymmetry } from './symmetry';
import { isIntentRecord } from './value';

export {
  PROJECT_INTENT_LIMITS,
  PROJECT_REFERENCE_ID_PATTERN_SOURCE,
  projectIntentsEqual
};
export type {
  NormalizeProjectIntentResult,
  ProjectIntentReader,
  ReadProjectIntentResult
} from './result';

const INTENT_KEYS = new Set<string>(PROJECT_INTENT_KEYS);
const INTENT_KEY_LIST = PROJECT_INTENT_KEYS.join(', ');

const reportUnknownIntentKeys = (
  value: Readonly<Record<string, unknown>>,
  issues: ProjectIntentIssueCollector
): void => {
  for (const key of Object.keys(value)) {
    if (!INTENT_KEYS.has(key)) issues.add(
      key,
      'Unknown project intent property.',
      INTENT_KEY_LIST
    );
  }
};

export const normalizeProjectIntent = (
  value: unknown
): NormalizeProjectIntentResult => {
  const issues = new ProjectIntentIssueCollector();
  if (!isIntentRecord(value)) {
    issues.add(
      'intent',
      'Project intent must be an object.',
      'project intent object'
    );
    return issues.failure();
  }
  reportUnknownIntentKeys(value, issues);
  const subject = normalizeIntentSubject(value.subject, issues);
  const forward = normalizeIntentForward(value.forward, issues);
  const grounding = normalizeIntentGrounding(value.grounding, issues);
  const symmetry = normalizeIntentSymmetry(value.symmetry, issues);
  const features = normalizeIntentFeatures(value.features, issues);
  const references = normalizeIntentReferences(value.references, issues);
  const composition = normalizeIntentComposition(
    value,
    value.grounding,
    symmetry,
    references ?? [],
    issues
  );
  if (
    issues.size > 0 ||
    forward === null ||
    grounding === null ||
    symmetry === null ||
    features === null ||
    references === null ||
    composition.semanticContract === null
  ) return issues.failure();

  const appearance = composition.appearance;
  const intent: ProjectIntent = {
    subject,
    forward,
    grounding,
    symmetry,
    semanticContract: composition.semanticContract,
    features,
    ...(references.length > 0 ? { references } : {}),
    ...(appearance.appearance
      ? {
          appearance: appearance.appearance,
          appearanceBindings: appearance.bindings ?? []
        }
      : {})
  };
  return { ok: true, intent };
};

export const readProjectIntent = (
  document: Pick<ProjectDocument, 'intent'>
): ReadProjectIntentResult => {
  if (document.intent === undefined) return { ok: true, intent: null };
  const normalized = normalizeProjectIntent(document.intent);
  if (!normalized.ok) return normalized;
  if (projectIntentsEqual(document.intent, normalized.intent)) return normalized;
  const issues = new ProjectIntentIssueCollector();
  issues.add(
    'intent',
    'Persisted project intent must use normalized text and stable ordering.',
    'normalized project intent'
  );
  return issues.failure();
};

export const projectIntentReader: ProjectIntentReader = Object.freeze({
  normalize: normalizeProjectIntent,
  read: readProjectIntent
});
