import type {
  InvariantFinding
} from '@ashfox/engine-core';

import type {
  ReadinessFinding
} from './inspectWorkflowTypes';

export interface ClassifiedWorkflowFindings {
  startup: ReadinessFinding | null;
  intent: ReadinessFinding | null;
  geometry: ReadinessFinding | null;
  authoring: ReadinessFinding | null;
  animation: ReadinessFinding | null;
}

export const isBlockingFinding = (
  finding: InvariantFinding
): boolean =>
  finding.severity === 'error' || finding.severity === 'warning';

export const findingHasCode = (
  finding: { readonly code: string },
  ...prefixes: readonly string[]
): boolean =>
  prefixes.some((prefix) => finding.code.startsWith(prefix));

const firstMatching = (
  findings: readonly ReadinessFinding[],
  predicate: (finding: ReadinessFinding) => boolean
): ReadinessFinding | null =>
  findings.find(predicate) ?? null;

const isProjectRootPath = (path: string): boolean =>
  [
    'schemaVersion',
    'id',
    'name',
    'revision',
    'createdAt',
    'updatedAt'
  ].includes(path) ||
  path.startsWith('formatProfile.') ||
  path.startsWith('settings.');

export const classifyWorkflowFindings = (
  findings: readonly ReadinessFinding[]
): ClassifiedWorkflowFindings => ({
  startup: firstMatching(
    findings,
    (finding) =>
      isProjectRootPath(finding.path) &&
      findingHasCode(
        finding,
        'document.',
        'identity.',
        'format.invalid_namespace',
        'format.invalid_resource_path',
        'format.invalid_identifier',
        'format.unsupported_data'
      ) &&
      finding.code !== 'document.invalid_intent'
  ),
  intent: firstMatching(
    findings,
    (finding) =>
      finding.code === 'document.invalid_intent' ||
      findingHasCode(
        finding,
        'production.intent_missing',
        'production.intent_invalid'
      )
  ),
  geometry: firstMatching(
    findings,
    (finding) => finding.code === 'production.geometry_missing'
  ),
  authoring: firstMatching(
    findings,
    (finding) =>
      finding.path.startsWith('scene.') ||
      finding.path.startsWith('modeling.') ||
      finding.path.startsWith('textures.') ||
      findingHasCode(
        finding,
        'scene.',
        'model.',
        'cube.',
        'mesh.',
        'texture.',
        'production.texture_',
        'production.intent_grounding_',
        'production.intent_evaluation_',
        'format.unbaked_',
        'format.coordinate_',
        'format.rotation_',
        'format.texture_',
        'format.uv_'
      )
  ),
  animation: firstMatching(
    findings,
    (finding) =>
      finding.path.startsWith('animations.') ||
      findingHasCode(
        finding,
        'animation.',
        'production.idle_',
        'production.animation_'
      )
  )
});
