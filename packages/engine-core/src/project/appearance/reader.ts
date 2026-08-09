import type {
  ProjectAppearanceBinding,
  ProjectAppearanceMarking,
  ProjectAppearanceTarget,
  ProjectAppearanceTexture,
  ProjectAppearanceV1
} from './contract';
import { PROJECT_APPEARANCE_SPECIFICATION as SPEC } from './contract';
import { collectProjectAppearanceOverlapIssues } from './overlap';
import { compareStableText } from '../../stableOrder';
import { isProjectSemanticIdentifier } from '../identifier';

export interface ProjectAppearanceIssue {
  readonly path: string;
  readonly message: string;
  readonly expected: string;
}

export interface NormalizedProjectAppearance {
  readonly appearance?: ProjectAppearanceV1;
  readonly bindings?: readonly ProjectAppearanceBinding[];
}

const PART_ID = /^[a-z][a-z0-9.-]*$/;
const COLOR = /^#[0-9A-F]{6}$/;

const isRecord = (
  value: unknown
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const reportUnknownKeys = (
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  path: string,
  issues: ProjectAppearanceIssue[]
): void => {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) issues.push({
      path: `${path}.${key}`,
      message: 'Unknown appearance property.',
      expected: allowed.join(', ')
    });
  }
};

const enumValue = <TValue extends string>(
  value: unknown,
  allowed: readonly TValue[],
  path: string,
  issues: ProjectAppearanceIssue[]
): TValue | null => {
  if (typeof value === 'string' && allowed.some((entry) => entry === value)) {
    return value as TValue;
  }
  issues.push({
    path,
    message: 'Unknown appearance vocabulary value.',
    expected: allowed.join(' | ')
  });
  return null;
};

const identifier = (
  value: unknown,
  path: string,
  issues: ProjectAppearanceIssue[]
): string | null => {
  if (isProjectSemanticIdentifier(value)) return value;
  issues.push({
    path,
    message: 'Appearance identifier is invalid.',
    expected: 'lower-kebab-case identifier'
  });
  return null;
};

const normalizeSeed = (
  value: unknown,
  issues: ProjectAppearanceIssue[]
): ProjectAppearanceV1['seed'] | null => {
  const path = 'appearance.seed';
  const { automatic, explicit } = SPEC.statements.seed.forms;
  if (!isRecord(value)) {
    issues.push({ path, message: 'Appearance seed must be an object.', expected: '{kind} or {kind,value}' });
    return null;
  }
  if (value.kind === automatic.kind) {
    reportUnknownKeys(value, automatic.properties, path, issues);
    return { kind: automatic.kind };
  }
  if (value.kind === explicit.kind) {
    reportUnknownKeys(value, explicit.properties, path, issues);
    const seed = typeof value.value === 'string' &&
      value.value !== automatic.sentinel &&
      new RegExp(explicit.value.pattern).test(value.value)
      ? value.value
      : null;
    if (!seed) issues.push({
      path: `${path}.value`,
      message: 'Appearance identifier is invalid.',
      expected: `${explicit.value.format} identifier`
    });
    const maximumKey = explicit.value.maxLength;
    const maximumLength = SPEC[maximumKey];
    if (seed && seed.length > maximumLength) {
      issues.push({
        path: `${path}.value`,
        message: 'Appearance seed is too long.',
        expected: `at most ${maximumLength} characters`
      });
      return null;
    }
    return seed ? { kind: explicit.kind, value: seed } : null;
  }
  issues.push({
    path: `${path}.kind`,
    message: 'Unknown appearance seed kind.',
    expected: `${automatic.kind} | ${explicit.kind}`
  });
  return null;
};

const normalizeTexture = (
  value: unknown,
  path: string,
  issues: ProjectAppearanceIssue[]
): ProjectAppearanceTexture | null => {
  if (!isRecord(value)) {
    issues.push({ path, message: 'Appearance texture must be an object.', expected: '{kind,scale,density,contrast}' });
    return null;
  }
  const schema = SPEC.statements.texture;
  reportUnknownKeys(
    value,
    schema.order,
    path,
    issues
  );
  const kind = enumValue(value.kind, SPEC[schema.values.kind], `${path}.kind`, issues);
  const scale = enumValue(value.scale, SPEC[schema.values.scale], `${path}.scale`, issues);
  const density = enumValue(value.density, SPEC[schema.values.density], `${path}.density`, issues);
  const contrast = enumValue(value.contrast, SPEC[schema.values.contrast], `${path}.contrast`, issues);
  return kind && scale && density && contrast
    ? { kind, scale, density, contrast }
    : null;
};

const normalizeTarget = (
  value: unknown,
  path: string,
  issues: ProjectAppearanceIssue[]
): ProjectAppearanceTarget | null => {
  if (!isRecord(value)) {
    issues.push({ path, message: 'Appearance target must be an object.', expected: '{kind,id?}' });
    return null;
  }
  const kind = enumValue(value.kind, SPEC.targets, `${path}.kind`, issues);
  if (!kind) return null;
  const idCardinality =
    SPEC.statements.mark.targetReferences[kind].idCardinality;
  if (idCardinality === 0) {
    reportUnknownKeys(value, ['kind'], path, issues);
    return { kind: 'face' };
  }
  reportUnknownKeys(value, ['kind', 'id'], path, issues);
  const id = identifier(value.id, `${path}.id`, issues);
  return id ? { kind, id } : null;
};

const supports = (
  values: readonly string[],
  value: string
): boolean => values.some((entry) => entry === value);

const normalizeMarking = (
  value: unknown,
  index: number,
  issues: ProjectAppearanceIssue[]
): ProjectAppearanceMarking | null => {
  const path = `appearance.markings[${index}]`;
  if (!isRecord(value)) {
    issues.push({ path, message: 'Appearance marking must be an object.', expected: 'closed semantic marking' });
    return null;
  }
  const schema = SPEC.statements.mark;
  reportUnknownKeys(
    value,
    schema.order,
    path,
    issues
  );
  const id = identifier(value.id, `${path}.id`, issues);
  const target = normalizeTarget(value.target, `${path}.target`, issues);
  const region = enumValue(
    value.region,
    SPEC.regions,
    `${path}.region`,
    issues
  );
  const placement = enumValue(
    value.placement,
    SPEC.placements,
    `${path}.placement`,
    issues
  );
  const motif = enumValue(value.motif, SPEC.motifs, `${path}.motif`, issues);
  const tone = enumValue(value.tone, SPEC.tones, `${path}.tone`, issues);
  const flow = value.flow === undefined
    ? undefined
    : enumValue(value.flow, SPEC.flows, `${path}.flow`, issues) ?? undefined;
  const variant = value.variant === undefined
    ? undefined
    : identifier(value.variant, `${path}.variant`, issues) ?? undefined;
  const scale = enumValue(value.scale, SPEC.scales, `${path}.scale`, issues);
  const density = enumValue(value.density, SPEC.densities, `${path}.density`, issues);
  const contrast = enumValue(value.contrast, SPEC.contrasts, `${path}.contrast`, issues);
  if (
    target &&
    region &&
    !supports(SPEC.capabilities[target.kind].regions, region)
  ) {
    issues.push({
      path: `${path}.region`,
      message: `Region "${region}" is not meaningful for ${target.kind}.`,
      expected: SPEC.capabilities[target.kind].regions.join(' | ')
    });
  }
  if (
    target &&
    placement &&
    !supports(SPEC.capabilities[target.kind].placements, placement)
  ) {
    issues.push({
      path: `${path}.placement`,
      message:
        `Placement "${placement}" is not meaningful for ${target.kind}.`,
      expected: SPEC.capabilities[target.kind].placements.join(' | ')
    });
  }
  const flowCondition = schema.conditions.flow;
  const allowedFlowMotifs = flowCondition.allowedWhen.motif;
  const flowsByMotif = SPEC[flowCondition.values];
  const motifAllowsFlow = motif ? supports(allowedFlowMotifs, motif) : false;
  if (motif && flow && (motifAllowsFlow
    ? !supports(flowsByMotif[motif], flow)
    : flowCondition.forbiddenOtherwise)) {
    issues.push({
      path: `${path}.flow`,
      message: `Motif "${motif}" does not accept flow "${flow}".`,
      expected: flowsByMotif[motif].join(' | ') || 'flow omitted'
    });
  }
  return id && target && region && placement && motif && tone && scale &&
    density && contrast
    ? {
        id, target, region, placement, motif, tone,
        ...(flow ? { flow } : {}),
        ...(variant ? { variant } : {}),
        scale, density, contrast
      }
    : null;
};

const normalizeBindings = (
  value: unknown,
  markings: ReadonlyMap<string, ProjectAppearanceMarking>,
  issues: ProjectAppearanceIssue[]
): readonly ProjectAppearanceBinding[] | null => {
  if (!Array.isArray(value)) {
    issues.push({
      path: 'appearanceBindings',
      message: 'Appearance bindings must be an array.',
      expected: 'one compiler-owned binding per marking'
    });
    return null;
  }
  const bindings: ProjectAppearanceBinding[] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    const path = `appearanceBindings[${index}]`;
    if (!isRecord(entry)) {
      issues.push({ path, message: 'Appearance binding must be an object.', expected: '{markingId,partIds,faceScope}' });
      return;
    }
    reportUnknownKeys(entry, ['markingId', 'partIds', 'faceScope', 'accentColor'], path, issues);
    const markingId = identifier(entry.markingId, `${path}.markingId`, issues);
    const faceScope = enumValue(
      entry.faceScope,
      ['full', 'anterior'] as const,
      `${path}.faceScope`,
      issues
    );
    const accentColor = entry.accentColor === undefined
      ? undefined
      : typeof entry.accentColor === 'string' && COLOR.test(entry.accentColor)
        ? entry.accentColor
        : null;
    if (accentColor === null) issues.push({
      path: `${path}.accentColor`,
      message: 'Appearance accent color is invalid.',
      expected: '#RRGGBB compiler palette color'
    });
    const rawPartIds = Array.isArray(entry.partIds) ? entry.partIds : null;
    const partIds = rawPartIds
      ? rawPartIds.filter((partId): partId is string =>
          typeof partId === 'string' && PART_ID.test(partId)
        )
      : [];
    if (
      !rawPartIds ||
      partIds.length !== rawPartIds.length ||
      partIds.length === 0 ||
      new Set(partIds).size !== partIds.length
    ) {
      issues.push({
        path: `${path}.partIds`,
        message: 'Appearance binding part IDs are invalid.',
        expected: 'non-empty unique generated part IDs'
      });
    }
    if (markingId && (!markings.has(markingId) || seen.has(markingId))) {
      issues.push({
        path: `${path}.markingId`,
        message: seen.has(markingId)
          ? 'Appearance marking has more than one binding.'
          : 'Appearance binding names an unknown marking.',
        expected: 'exactly one binding for every appearance marking'
      });
    }
    const marking = markingId ? markings.get(markingId) : undefined;
    if (
      marking &&
      (marking.tone === 'accent') !== (typeof accentColor === 'string')
    ) issues.push({
      path: `${path}.accentColor`,
      message: marking.tone === 'accent'
        ? 'Accent marking requires its compiler palette projection.'
        : 'Only an accent marking may carry an accent color.',
      expected: marking.tone === 'accent' ? '#RRGGBB' : 'property omitted'
    });
    if (markingId) seen.add(markingId);
    if (markingId && faceScope && partIds.length === rawPartIds?.length && partIds.length > 0) {
      bindings.push({
        markingId,
        partIds: [...partIds].sort(compareStableText),
        faceScope,
        ...(accentColor ? { accentColor } : {})
      });
    }
  });
  for (const markingId of markings.keys()) {
    if (!seen.has(markingId)) issues.push({
      path: 'appearanceBindings',
      message: `Appearance marking "${markingId}" has no generated target binding.`,
      expected: 'exactly one binding for every appearance marking'
    });
  }
  return bindings.sort((left, right) =>
    compareStableText(left.markingId, right.markingId)
  );
};

export const normalizeProjectAppearanceIntent = (
  appearanceValue: unknown,
  issues: ProjectAppearanceIssue[]
): ProjectAppearanceV1 | null => {
  const issueStart = issues.length;
  if (!isRecord(appearanceValue)) {
    issues.push({ path: 'appearance', message: 'Appearance intent must be an object.', expected: '{version,seed,texture,markings}' });
    return null;
  }
  reportUnknownKeys(appearanceValue, ['version', 'seed', 'texture', 'markings'], 'appearance', issues);
  if (appearanceValue.version !== SPEC.version) issues.push({
    path: 'appearance.version',
    message: 'Unknown Surface Appearance version.',
    expected: String(SPEC.version)
  });
  const seed = normalizeSeed(appearanceValue.seed, issues);
  const texture = normalizeTexture(appearanceValue.texture, 'appearance.texture', issues);
  const markings: ProjectAppearanceMarking[] = [];
  const markingCardinality = SPEC.statements.mark.cardinality;
  const maximumMarkings = SPEC[markingCardinality.maximum];
  if (!Array.isArray(appearanceValue.markings) ||
    appearanceValue.markings.length < markingCardinality.minimum ||
    appearanceValue.markings.length > maximumMarkings) {
    issues.push({
      path: 'appearance.markings',
      message: 'Appearance markings must be a bounded array.',
      expected: `${markingCardinality.minimum}-${maximumMarkings} markings`
    });
  } else appearanceValue.markings.forEach((entry, index) => {
    const marking = normalizeMarking(entry, index, issues);
    if (marking) markings.push(marking);
  });
  const identity = SPEC.statements.mark.identity;
  const ids = new Set<string>();
  for (const marking of markings) {
    const id = marking[identity.field];
    if (identity.unique && ids.has(id)) issues.push({
      path: `appearance.markings.${id}.${identity.field}`,
      message: `Appearance marking ID "${id}" is duplicated.`,
      expected: 'unique stable marking ID'
    });
    ids.add(id);
  }
  issues.push(...collectProjectAppearanceOverlapIssues(markings));
  if (
    issues.length !== issueStart ||
    appearanceValue.version !== SPEC.version ||
    !seed || !texture
  ) return null;
  return {
    version: SPEC.version,
    seed,
    texture,
    markings: [...markings].sort((left, right) =>
      compareStableText(left.id, right.id)
    )
  };
};

export const normalizeProjectAppearance = (
  appearanceValue: unknown,
  bindingValue: unknown,
  issues: ProjectAppearanceIssue[]
): NormalizedProjectAppearance => {
  const issueStart = issues.length;
  if (appearanceValue === undefined) {
    if (bindingValue !== undefined) issues.push({
      path: 'appearanceBindings',
      message: 'Appearance bindings require normalized appearance intent.',
      expected: 'appearance and appearanceBindings together'
    });
    return {};
  }
  const appearance = normalizeProjectAppearanceIntent(
    appearanceValue, issues
  );
  const markings = new Map(
    appearance?.markings.map((marking) => [marking.id, marking] as const) ?? []
  );
  const bindings = normalizeBindings(bindingValue, markings, issues);
  return issues.length === issueStart && appearance && bindings
    ? { appearance, bindings }
    : {};
};
