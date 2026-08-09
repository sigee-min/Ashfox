import type { InvariantFinding } from '@ashfox/engine-core';

import type { ReadinessFinding } from './inspectWorkflowTypes';

/** Findings grouped by the only recovery boundaries exposed to the Agent. */
export interface ClassifiedWorkflowFindings {
  startup: ReadinessFinding | null;
  intent: ReadinessFinding | null;
  geometry: ReadinessFinding | null;
  authoring: ReadinessFinding | null;
  animation: ReadinessFinding | null;
}

export const isBlockingFinding = (
  finding: InvariantFinding
): boolean => finding.severity === 'error' || finding.severity === 'warning';

const first = (
  findings: readonly ReadinessFinding[],
  predicate: (finding: ReadinessFinding) => boolean
): ReadinessFinding | null => findings.find(predicate) ?? null;

const isSetupFinding = (finding: ReadinessFinding): boolean =>
  [
    'schemaVersion',
    'id',
    'name',
    'revision',
    'createdAt',
    'updatedAt'
  ].includes(finding.path) ||
  finding.path.startsWith('settings.');

/**
 * Agent workflow deliberately has only setup and intent-program recovery.
 * Everything after source compilation is compiler-owned and must be repaired
 * by proposing a replacement source, not by classifying internals for a patch.
 */
export const classifyWorkflowFindings = (
  findings: readonly ReadinessFinding[]
): ClassifiedWorkflowFindings => {
  const startup = first(findings, isSetupFinding);
  const intent = first(findings, (finding) => finding !== startup);
  return {
    startup,
    intent,
    geometry: null,
    authoring: null,
    animation: null
  };
};
