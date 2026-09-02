import type { InvariantFinding } from '@ashfox/engine-core';

import type { ReadinessFinding } from './inspectWorkflowTypes';

/** Findings grouped by the only setup boundary exposed to the Agent. */
export interface ClassifiedWorkflowFindings {
  startup: ReadinessFinding | null;
}

export const isBlockingFinding = (
  finding: InvariantFinding
): boolean => finding.severity === 'error' || finding.severity === 'warning';

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
 * Agent workflow deliberately has only setup and authored-source recovery.
 * Everything after source compilation is compiler-owned and must be repaired
 * by proposing a replacement source, not by classifying internals for a patch.
 */
export const classifyWorkflowFindings = (
  findings: readonly ReadinessFinding[]
): ClassifiedWorkflowFindings => {
  return { startup: findings.find(isSetupFinding) ?? null };
};
