import type {
  CommandReceipt,
  ProjectDocument,
  ValidationReport
} from '@ashfox/engine-core';

import type {
  ProjectAssets
} from '../../application/projectAssets';
import {
  inspectCommand
} from './inspect/inspectCommand';
import {
  inspectFinding
} from './inspect/inspectFinding';
import {
  inspectIntentProgram
} from './inspect/inspectIntentProgram';
import {
  inspectOverview
} from './inspect/inspectOverview';
import type {
  VisualReviewReceipt
} from '../../application/review';
import type {
  InspectRequest,
  InspectResult
} from './types';

export const inspectProject = (
  document: ProjectDocument,
  selectedNodeId: string | null,
  report: ValidationReport,
  request?: InspectRequest,
  _activity: readonly CommandReceipt[] = [],
  _assets: ProjectAssets = {},
  visualReviews: readonly VisualReviewReceipt[] = [],
  operationOwner: string | null = null
): InspectResult => {
  if (!request) {
    return inspectOverview(
      document,
      selectedNodeId,
      report,
      visualReviews,
      operationOwner
    );
  }

  switch (request.kind) {
    case 'command':
      return inspectCommand(document, request.name);
    case 'finding':
      return inspectFinding(document, report, request.path);
    case 'intent-program':
      return inspectIntentProgram(document, request.source);
    default:
      return {
        ok: false,
        revision: document.revision,
        error: {
          code: 'invalid_request',
          path: 'kind',
          expected: 'command, finding, or intent-program'
        }
      };
  }
};
