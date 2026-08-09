import type {
  ProjectReferenceKind,
  ProjectReferenceObservation
} from '../../model';
import {
  PROJECT_INTENT_LIMITS,
  PROJECT_REFERENCE_ID_PATTERN_SOURCE,
  PROJECT_REFERENCE_KEYS,
  PROJECT_REFERENCE_KINDS
} from './contract';
import { ProjectIntentIssueCollector } from './result';
import {
  isIntentRecord,
  normalizeIntentText,
  uniqueStableText
} from './value';

const REFERENCE_KEYS = new Set<string>(PROJECT_REFERENCE_KEYS);
const REFERENCE_KEY_LIST = PROJECT_REFERENCE_KEYS.join(', ');
const REFERENCE_KINDS = new Set<ProjectReferenceKind>(PROJECT_REFERENCE_KINDS);
const REFERENCE_ID_PATTERN = new RegExp(PROJECT_REFERENCE_ID_PATTERN_SOURCE);

const normalizeReferenceCues = (
  value: unknown,
  path: string,
  issues: ProjectIntentIssueCollector
): readonly string[] | null => {
  if (
    !Array.isArray(value) ||
    value.length > PROJECT_INTENT_LIMITS.maxReferenceCues
  ) {
    issues.add(
      path,
      'Reference cues must be a bounded array.',
      `0-${PROJECT_INTENT_LIMITS.maxReferenceCues} concise strings`
    );
    return null;
  }
  const cues: string[] = [];
  value.forEach((entry, index) => {
    const cue = typeof entry === 'string' ? normalizeIntentText(entry) : '';
    if (
      cue.length === 0 ||
      cue.length > PROJECT_INTENT_LIMITS.maxReferenceCueLength
    ) {
      issues.addAt(
        path,
        `[${index}]`,
        'Reference cue is empty or too long.',
        `1-${PROJECT_INTENT_LIMITS.maxReferenceCueLength} normalized characters`
      );
      return;
    }
    cues.push(cue);
  });
  return uniqueStableText(cues);
};

export const normalizeIntentReferences = (
  value: unknown,
  issues: ProjectIntentIssueCollector
): readonly ProjectReferenceObservation[] | null => {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > PROJECT_INTENT_LIMITS.maxReferences
  ) {
    issues.add(
      'references',
      'Reference observations must be a bounded array.',
      `0-${PROJECT_INTENT_LIMITS.maxReferences} reference observations`
    );
    return null;
  }
  const references: ProjectReferenceObservation[] = [];
  const ids = new Set<string>();
  value.forEach((entry, index) => {
    const path = `references[${index}]`;
    if (!isIntentRecord(entry)) {
      issues.add(
        path,
        'Reference observation must be an object.',
        '{id,kind,description,cues,contentHash?}'
      );
      return;
    }
    for (const key of Object.keys(entry)) {
      if (!REFERENCE_KEYS.has(key)) issues.addAt(
        path,
        key,
        'Unknown reference observation property.',
        REFERENCE_KEY_LIST
      );
    }
    const id = typeof entry.id === 'string' ? entry.id : '';
    const duplicateId = ids.has(id);
    if (!REFERENCE_ID_PATTERN.test(id) || duplicateId) {
      issues.addAt(
        path,
        'id',
        duplicateId
          ? 'Reference observation ID is duplicated.'
          : 'Reference observation ID is invalid.',
        'unique lowercase stable ID up to 64 characters'
      );
    }
    ids.add(id);
    const kind = entry.kind;
    const validKind = typeof kind === 'string' &&
      REFERENCE_KINDS.has(kind as ProjectReferenceKind);
    if (!validKind) {
      issues.addAt(
        path,
        'kind',
        'Reference observation kind is invalid.',
        'image | text | model'
      );
    }
    const description = typeof entry.description === 'string'
      ? normalizeIntentText(entry.description)
      : '';
    const validDescription = description.length > 0 &&
      description.length <= PROJECT_INTENT_LIMITS.maxReferenceDescriptionLength;
    if (!validDescription) {
      issues.addAt(
        path,
        'description',
        'Reference description is empty or too long.',
        `1-${PROJECT_INTENT_LIMITS.maxReferenceDescriptionLength} normalized characters`
      );
    }
    const cues = normalizeReferenceCues(
      entry.cues,
      `${path}.cues`,
      issues
    );
    const contentHash = entry.contentHash;
    const normalizedHash = typeof contentHash === 'string'
      ? normalizeIntentText(contentHash)
      : null;
    if (
      contentHash !== undefined &&
      (
        normalizedHash === null ||
        normalizedHash.length === 0 ||
        normalizedHash.length > 160
      )
    ) {
      issues.addAt(
        path,
        'contentHash',
        'Reference content hash is invalid.',
        '1-160 normalized characters when provided'
      );
    }
    if (
      REFERENCE_ID_PATTERN.test(id) &&
      validKind &&
      validDescription &&
      cues !== null
    ) {
      references.push({
        id,
        kind: kind as ProjectReferenceKind,
        description,
        cues,
        ...(normalizedHash === null ? {} : { contentHash: normalizedHash })
      });
    }
  });
  return references.sort((left, right) => left.id < right.id ? -1 :
    left.id > right.id ? 1 : 0);
};
