import type {
  ProjectCanonicalSupport,
  ProjectReferenceObservation,
  ProjectSemanticContract,
  ProjectSemanticFace,
  ProjectSubjectDomain,
  ProjectSupportedSurfaceObligation,
  ProjectSupportedSurfaceAnchor,
  ProjectSupportedSurfaceGrowth,
  ProjectSupportedSurfaceRole,
  ProjectSymmetry
} from '../../model';
import { compareStableText } from '../../stableOrder';
import {
  PROJECT_INTENT_STABLE_ID_PATTERN_SOURCE,
  PROJECT_SUPPORTED_SURFACE_LIMIT
} from '../intent/contract';
import { projectPairPlaneTwice } from '../frame';

export interface ProjectSemanticContractIssue {
  path: string;
  message: string;
  expected: string;
}

const REFERENCE_ID_PATTERN = new RegExp(
  PROJECT_INTENT_STABLE_ID_PATTERN_SOURCE
);
const SEMANTIC_CONTRACT_KEYS = new Set([
  'subjectDomain',
  'canonicalSupport',
  'face',
  'supportedSurfaces'
]);
const SUBJECT_DOMAINS = new Set<ProjectSubjectDomain>([
  'organism',
  'constructed'
]);
const CANONICAL_SUPPORT_KINDS = new Set<ProjectCanonicalSupport['kind']>([
  'standing-feet',
  'rolling-wheels',
  'supported-base',
  'none',
  'free-explicit'
]);
const SUPPORTED_SURFACE_ROLES = new Set<ProjectSupportedSurfaceRole>([
  'wing',
  'fin',
  'sail',
  'panel'
]);
const SUPPORTED_SURFACE_CARDINALITIES = new Set([
  'paired',
  'single'
]);
const SUPPORTED_SURFACE_ANCHORS =
  new Set<ProjectSupportedSurfaceAnchor>([
    'front',
    'rear',
    'top',
    'bottom',
    'left',
    'right',
    'sides'
  ]);
const SUPPORTED_SURFACE_GROWTH =
  new Set<ProjectSupportedSurfaceGrowth>([
    'forward',
    'rearward',
    'up',
    'down',
    'left',
    'right',
    'outward'
  ]);

const isRecord = (
  value: unknown
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const exactKeys = (
  value: Readonly<Record<string, unknown>>,
  keys: ReadonlySet<string>
): boolean => Object.keys(value).length === keys.size &&
  Object.keys(value).every((key) => keys.has(key));

const normalizedCanonicalSupport = (
  value: unknown,
  grounding: unknown,
  references: readonly ProjectReferenceObservation[],
  issues: ProjectSemanticContractIssue[]
): ProjectCanonicalSupport | null => {
  if (!isRecord(value) || typeof value.kind !== 'string' ||
    !CANONICAL_SUPPORT_KINDS.has(value.kind as ProjectCanonicalSupport['kind'])) {
    issues.push({
      path: 'semanticContract.canonicalSupport',
      message: 'Canonical support must use a recognized closed contract.',
      expected:
        '{kind:standing-feet|rolling-wheels|supported-base|none} | ' +
        '{kind:"free-explicit",referenceIds:[...]}'
    });
    return null;
  }
  const kind = value.kind as ProjectCanonicalSupport['kind'];
  if (kind !== 'free-explicit') {
    if (!exactKeys(value, new Set(['kind']))) {
      issues.push({
        path: 'semanticContract.canonicalSupport',
        message: `Canonical support "${kind}" accepts no additional fields.`,
        expected: '{kind}'
      });
      return null;
    }
    const requiredGrounding = kind === 'none' ? 'none' : 'grounded';
    if (grounding !== requiredGrounding) {
      issues.push({
        path: 'grounding',
        message:
          `Grounding contradicts canonical support "${kind}".`,
        expected: requiredGrounding
      });
      return null;
    }
    return { kind } as ProjectCanonicalSupport;
  }
  if (!exactKeys(value, new Set(['kind', 'referenceIds'])) ||
    !Array.isArray(value.referenceIds) || value.referenceIds.length === 0) {
    issues.push({
      path: 'semanticContract.canonicalSupport.referenceIds',
      message: 'Free support requires explicit non-empty reference evidence.',
      expected: 'one or more unique IDs from intent.references'
    });
    return null;
  }
  const referenceIds = value.referenceIds.filter(
    (entry): entry is string =>
      typeof entry === 'string' && REFERENCE_ID_PATTERN.test(entry)
  );
  if (referenceIds.length !== value.referenceIds.length ||
    new Set(referenceIds).size !== referenceIds.length) {
    issues.push({
      path: 'semanticContract.canonicalSupport.referenceIds',
      message: 'Free-support reference IDs are invalid or duplicated.',
      expected: 'unique lowercase stable reference IDs'
    });
    return null;
  }
  const availableIds = new Set(references.map((reference) => reference.id));
  const missingId = referenceIds.find((id) => !availableIds.has(id));
  if (missingId) {
    issues.push({
      path: 'semanticContract.canonicalSupport.referenceIds',
      message: `Free-support evidence "${missingId}" is not declared in references.`,
      expected: 'IDs from intent.references'
    });
    return null;
  }
  if (grounding !== 'free-explicit') {
    issues.push({
      path: 'grounding',
      message:
        'Free-explicit canonical support requires free-explicit grounding.',
      expected: 'free-explicit'
    });
    return null;
  }
  return {
    kind: 'free-explicit',
    referenceIds: [...referenceIds].sort(compareStableText)
  };
};

const normalizedSemanticFace = (
  value: unknown,
  symmetry: ProjectSymmetry | null,
  issues: ProjectSemanticContractIssue[]
): ProjectSemanticFace | null => {
  if (!isRecord(value) || (value.kind !== 'none' && value.kind !== 'full')) {
    issues.push({
      path: 'semanticContract.face',
      message: 'Semantic face must use the closed none or full contract.',
      expected:
        '{kind:"none"} | {kind:"full",eyeConfiguration:single|paired,' +
        'nasal:present|absent,oral:present|absent}'
    });
    return null;
  }
  if (value.kind === 'none') {
    if (!exactKeys(value, new Set(['kind']))) {
      issues.push({
        path: 'semanticContract.face',
        message: 'A none face accepts no additional fields.',
        expected: '{kind:"none"}'
      });
      return null;
    }
    return { kind: 'none' };
  }
  if (!exactKeys(
    value,
    new Set(['kind', 'eyeConfiguration', 'nasal', 'oral'])
  ) ||
    (value.eyeConfiguration !== 'single' &&
      value.eyeConfiguration !== 'paired') ||
    (value.nasal !== 'present' && value.nasal !== 'absent') ||
    (value.oral !== 'present' && value.oral !== 'absent')) {
    issues.push({
      path: 'semanticContract.face',
      message:
        'A full face must declare eye configuration and nasal/oral presence.',
      expected:
        '{kind:"full",eyeConfiguration:single|paired,' +
        'nasal:present|absent,oral:present|absent}'
    });
    return null;
  }
  if (value.eyeConfiguration === 'paired' &&
    (!symmetry || projectPairPlaneTwice(symmetry) === null)) {
    issues.push({
      path: 'semanticContract.face.eyeConfiguration',
      message: 'Paired eyes require a local or global reflection plane.',
      expected: 'pair reflection authority or single eye configuration'
    });
    return null;
  }
  return {
    kind: 'full',
    eyeConfiguration: value.eyeConfiguration,
    nasal: value.nasal as 'present' | 'absent',
    oral: value.oral as 'present' | 'absent'
  };
};

const normalizedSupportedSurfaces = (
  value: unknown,
  symmetry: ProjectSymmetry | null,
  issues: ProjectSemanticContractIssue[]
): readonly ProjectSupportedSurfaceObligation[] | null => {
  if (!Array.isArray(value) ||
    value.length > PROJECT_SUPPORTED_SURFACE_LIMIT) {
    issues.push({
      path: 'semanticContract.supportedSurfaces',
      message: 'Supported-surface obligations must be a bounded array.',
      expected: `0-${PROJECT_SUPPORTED_SURFACE_LIMIT} obligations`
    });
    return null;
  }
  const result: ProjectSupportedSurfaceObligation[] = [];
  const ids = new Set<string>();
  value.forEach((entry, index) => {
    const path = `semanticContract.supportedSurfaces[${index}]`;
    if (!isRecord(entry) ||
      !exactKeys(
        entry,
        new Set(['id', 'role', 'cardinality', 'anchor', 'growth'])
      )) {
      issues.push({
        path,
        message: 'Supported surface must use the closed obligation shape.',
        expected:
          '{id,role:wing|fin|sail|panel,cardinality:paired|single,' +
          'anchor:front|rear|top|bottom|left|right|sides,' +
          'growth:forward|rearward|up|left|right|outward}'
      });
      return;
    }
    const id = typeof entry.id === 'string' ? entry.id : '';
    const role = entry.role;
    const cardinality = entry.cardinality;
    const anchor = entry.anchor;
    const growth = entry.growth;
    if (!REFERENCE_ID_PATTERN.test(id) || ids.has(id)) {
      issues.push({
        path: `${path}.id`,
        message: ids.has(id)
          ? 'Supported-surface obligation ID is duplicated.'
          : 'Supported-surface obligation ID is invalid.',
        expected: 'unique lowercase stable ID up to 64 characters'
      });
      return;
    }
    ids.add(id);
    if (typeof role !== 'string' ||
      !SUPPORTED_SURFACE_ROLES.has(role as ProjectSupportedSurfaceRole)) {
      issues.push({
        path: `${path}.role`,
        message: 'Supported-surface role is invalid.',
        expected: 'wing | fin | sail | panel'
      });
      return;
    }
    if (typeof cardinality !== 'string' ||
      !SUPPORTED_SURFACE_CARDINALITIES.has(cardinality)) {
      issues.push({
        path: `${path}.cardinality`,
        message: 'Supported-surface cardinality is invalid.',
        expected: 'paired | single'
      });
      return;
    }
    if (typeof anchor !== 'string' ||
      !SUPPORTED_SURFACE_ANCHORS.has(
        anchor as ProjectSupportedSurfaceAnchor
      )) {
      issues.push({
        path: `${path}.anchor`,
        message: 'Supported surface parent anchor is invalid.',
        expected: 'front | rear | top | bottom | left | right | sides'
      });
      return;
    }
    if (typeof growth !== 'string' ||
      !SUPPORTED_SURFACE_GROWTH.has(
        growth as ProjectSupportedSurfaceGrowth
      )) {
      issues.push({
        path: `${path}.growth`,
        message: 'Supported surface growth direction is invalid.',
        expected: 'forward | rearward | up | left | right | outward'
      });
      return;
    }
    if (cardinality === 'paired' &&
      (!symmetry || projectPairPlaneTwice(symmetry) === null)) {
      issues.push({
        path: `${path}.cardinality`,
        message: 'Paired supported surfaces require a reflection plane.',
        expected: 'local/global pair reflection authority or single cardinality'
      });
      return;
    }
    if (cardinality === 'paired' && anchor !== 'sides') {
      issues.push({
        path: `${path}.anchor`,
        message: 'Paired surfaces attach through the sides anchor.',
        expected: 'sides'
      });
      return;
    }
    if (cardinality === 'single' && anchor === 'sides') {
      issues.push({
        path: `${path}.anchor`,
        message: 'A single surface must name one concrete parent anchor.',
        expected: 'front | rear | top | bottom | left | right'
      });
      return;
    }
    if (cardinality === 'single' &&
      (anchor === 'left' || anchor === 'right') &&
      symmetry?.kind === 'bilateral') {
      issues.push({
        path: `${path}.anchor`,
        message: 'A bilateral single surface cannot own only one side anchor.',
        expected: 'paired sides surface, or centered front/rear/top surface'
      });
      return;
    }
    if (cardinality === 'paired' &&
      (growth === 'left' || growth === 'right')) {
      issues.push({
        path: `${path}.growth`,
        message: 'Paired surfaces cannot grow toward only one side.',
        expected: 'outward | up | forward | rearward'
      });
      return;
    }
    if (cardinality === 'single' && growth === 'outward') {
      issues.push({
        path: `${path}.growth`,
        message: 'Outward growth requires paired sides topology.',
        expected: 'forward | rearward | up | left | right'
      });
      return;
    }
    result.push({
      id,
      role: role as ProjectSupportedSurfaceRole,
      cardinality: cardinality as 'paired' | 'single',
      anchor: anchor as ProjectSupportedSurfaceAnchor,
      growth: growth as ProjectSupportedSurfaceGrowth
    });
  });
  return result.sort((left, right) => compareStableText(left.id, right.id));
};

export const normalizeProjectSemanticContract = (
  value: unknown,
  grounding: unknown,
  symmetry: ProjectSymmetry | null,
  references: readonly ProjectReferenceObservation[],
  issues: ProjectSemanticContractIssue[]
): ProjectSemanticContract | null => {
  if (!isRecord(value) || !exactKeys(value, SEMANTIC_CONTRACT_KEYS)) {
    issues.push({
      path: 'semanticContract',
      message: 'Semantic contract must use the complete closed shape.',
      expected: '{subjectDomain,canonicalSupport,face,supportedSurfaces}'
    });
    return null;
  }
  const subjectDomain = value.subjectDomain;
  if (typeof subjectDomain !== 'string' ||
    !SUBJECT_DOMAINS.has(subjectDomain as ProjectSubjectDomain)) {
    issues.push({
      path: 'semanticContract.subjectDomain',
      message: 'Subject domain is invalid.',
      expected: 'organism | constructed'
    });
  }
  const canonicalSupport = normalizedCanonicalSupport(
    value.canonicalSupport,
    grounding,
    references,
    issues
  );
  const face = normalizedSemanticFace(value.face, symmetry, issues);
  const supportedSurfaces = normalizedSupportedSurfaces(
    value.supportedSurfaces,
    symmetry,
    issues
  );
  if (subjectDomain === 'organism' &&
    (canonicalSupport?.kind === 'supported-base' ||
      canonicalSupport?.kind === 'rolling-wheels')) {
    issues.push({
      path: 'semanticContract.canonicalSupport',
      message: 'An organism cannot reclassify body contact as base or wheel support.',
      expected: 'standing-feet, none, or free-explicit'
    });
  }
  if (typeof subjectDomain !== 'string' ||
    !SUBJECT_DOMAINS.has(subjectDomain as ProjectSubjectDomain) ||
    !canonicalSupport || !face || !supportedSurfaces || issues.length > 0) {
    return null;
  }
  return {
    subjectDomain: subjectDomain as ProjectSubjectDomain,
    canonicalSupport,
    face,
    supportedSurfaces
  };
};
