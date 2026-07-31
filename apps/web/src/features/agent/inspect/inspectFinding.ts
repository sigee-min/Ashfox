import {
  evaluateProductionReadiness,
  type ProjectDocument,
  type ValidationReport
} from '@ashfox/engine-core';

import {
  boundedSuccess
} from '../boundedResult';
import type {
  InspectResult
} from '../types';
import {
  DETAIL_INSPECT_LIMIT
} from './inspectResult';

export const inspectFinding = (
  document: ProjectDocument,
  report: ValidationReport,
  path: string
): InspectResult => {
  const readiness = evaluateProductionReadiness(document, report);
  const finding = [
    ...report.findings,
    ...readiness.findings
  ].find((candidate) => candidate.path === path);
  if (!finding) {
    return {
      ok: false,
      revision: document.revision,
      error: {
        code: 'not_found',
        path,
        expected: 'validation finding path'
      }
    };
  }
  const exact = boundedSuccess(
    document.revision,
    finding,
    DETAIL_INSPECT_LIMIT
  );
  if (exact.ok) return exact;
  return {
    ok: true,
    revision: document.revision,
    truncated: true,
    data: {
      code: finding.code,
      severity: finding.severity,
      message: finding.message.slice(0, 1_000),
      path: finding.path,
      entityCount: finding.entityIds?.length ?? 0,
      assetCount: finding.assetIds?.length ?? 0,
      clipCount: finding.clipIds?.length ?? 0,
      fix: finding.fix?.slice(0, 1_000)
    }
  };
};
