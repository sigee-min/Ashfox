import type {
  ProjectAppearanceMarking,
  ProjectAppearanceSeed,
  ProjectAppearanceTarget,
  ProjectAppearanceTexture,
  ProjectAppearanceV1
} from './contract';
import { PROJECT_APPEARANCE_SPECIFICATION } from './contract';
import {
  normalizeProjectAppearanceIntent,
  type ProjectAppearanceIssue
} from './reader';

export interface AppearanceNormalizationReporter {
  reportPath(code: string, message: string, path: string): void;
}

type AppearanceTargetReferences = typeof PROJECT_APPEARANCE_SPECIFICATION[
  'statements'
]['mark']['targetReferences'];
type AppearanceReferenceNamespace = AppearanceTargetReferences[
  keyof AppearanceTargetReferences
]['namespace'];

export interface AppearanceNormalizationContext {
  readonly references: Readonly<Record<
    AppearanceReferenceNamespace,
    boolean | ReadonlySet<string>
  >>;
}

/** Readonly structural seam; program syntax satisfies it without a dependency. */
export interface AppearanceNormalizationInput {
  readonly palette?: string;
  readonly texture?: ProjectAppearanceTexture;
  readonly seed?: ProjectAppearanceSeed;
  readonly markings: readonly ProjectAppearanceMarking[];
}

const markingPath = (marking: ProjectAppearanceMarking): string =>
  `appearance.markings.${marking.id}`;

const targetExists = (
  target: ProjectAppearanceTarget,
  context: AppearanceNormalizationContext
): boolean => {
  const namespace = PROJECT_APPEARANCE_SPECIFICATION.statements.mark
    .targetReferences[target.kind].namespace;
  const references = context.references[namespace];
  const id = 'id' in target ? target.id : null;
  return typeof references === 'boolean'
    ? references && id === null
    : id !== null && references.has(id);
};

const validateTargets = (
  markings: readonly ProjectAppearanceMarking[],
  context: AppearanceNormalizationContext,
  reporter: AppearanceNormalizationReporter
): void => {
  for (const marking of markings) {
    if (targetExists(marking.target, context)) continue;
    const path = markingPath(marking);
    const reference = PROJECT_APPEARANCE_SPECIFICATION.statements.mark
      .targetReferences[marking.target.kind];
    const targetId = 'id' in marking.target ? marking.target.id : '';
    const description = reference.idCardinality === 0
      ? `the declared ${reference.namespace}`
      : `${marking.target.kind} "${targetId}"`;
    reporter.reportPath(
      'intent.unknown_appearance_target',
      `Appearance mark "${marking.id}" names unavailable ${description}.`,
      reference.idCardinality === 0
        ? `${path}.target.kind`
        : `${path}.target.id`
    );
  }
};

const sourcePathForIssue = (
  path: string,
  markings: readonly ProjectAppearanceMarking[]
): string => {
  const indexed = /^appearance\.markings\[(\d+)](.*)$/.exec(path);
  if (indexed) {
    const index = Number(indexed[1]);
    const marking = markings[index];
    if (marking) return `${markingPath(marking)}${indexed[2] ?? ''}`;
  }
  const markingCardinality =
    PROJECT_APPEARANCE_SPECIFICATION.statements.mark.cardinality;
  const maximumMarkings =
    PROJECT_APPEARANCE_SPECIFICATION[markingCardinality.maximum];
  if (path === 'appearance.markings' && markings.length > maximumMarkings) {
    const firstExcess = markings[maximumMarkings];
    if (firstExcess) return `${markingPath(firstExcess)}.id`;
  }
  return path;
};

const issueCode = (issue: ProjectAppearanceIssue): string => {
  if (issue.message.includes('ambiguous same-class overlap')) {
    return 'intent.ambiguous_appearance_overlap';
  }
  if (issue.path.endsWith('.region')) return 'intent.invalid_appearance_region';
  if (issue.path.endsWith('.placement')) {
    return 'intent.invalid_appearance_placement';
  }
  if (issue.path.endsWith('.flow')) return 'intent.invalid_appearance_flow';
  if (issue.message.includes('bounded array')) {
    return 'intent.too_many_appearance_marks';
  }
  if (issue.message.includes('duplicated')) return 'intent.duplicate_appearance_mark';
  return 'intent.invalid_appearance';
};

export const normalizeIntentProgramAppearance = (
  raw: AppearanceNormalizationInput,
  context: AppearanceNormalizationContext,
  reporter: AppearanceNormalizationReporter
): ProjectAppearanceV1 | null => {
  validateTargets(raw.markings, context, reporter);
  if (!raw.texture || !raw.seed) return null;
  const issues: ProjectAppearanceIssue[] = [];
  const normalized = normalizeProjectAppearanceIntent({
    version: 1,
    seed: raw.seed,
    texture: raw.texture,
    markings: raw.markings
  }, issues);
  for (const issue of issues) reporter.reportPath(
    issueCode(issue),
    issue.message,
    sourcePathForIssue(issue.path, raw.markings)
  );
  return raw.palette && raw.texture && raw.seed ? normalized : null;
};
