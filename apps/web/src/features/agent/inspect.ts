import type {
  CommandReceipt,
  ProjectDocument,
  ValidationReport
} from '@ashfox/engine-core';

import type {
  ProjectAssets
} from '../../application/projectAssets';
import {
  inspectClipRequest
} from './inspect/inspectClipRequest';
import {
  inspectCommand
} from './inspect/inspectCommand';
import {
  inspectFinding
} from './inspect/inspectFinding';
import {
  inspectOverview
} from './inspect/inspectOverview';
import {
  inspectActivityPage,
  inspectCatalogPage
} from './inspect/inspectPages';
import {
  inspectParts
} from './inspect/inspectParts';
import {
  inspectRecordSelection
} from './inspect/inspectRecordSelection';
import {
  inspectTarget
} from './inspect/inspectTarget';
import type {
  VisualReviewReceipt
} from './presentationReview';
import type {
  InspectRequest,
  InspectResult
} from './types';

export const inspectProject = (
  document: ProjectDocument,
  selectedNodeId: string | null,
  report: ValidationReport,
  request?: InspectRequest,
  activity: readonly CommandReceipt[] = [],
  assets: ProjectAssets = {},
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
    case 'catalog':
      return inspectCatalogPage(
        document,
        request.cursor,
        request.limit
      );
    case 'parts':
      return inspectParts(document, request.ids, report);
    case 'entity':
      return inspectRecordSelection({
        revision: document.revision,
        record: document.scene.nodes,
        ids: request.ids,
        label: 'entity'
      });
    case 'texture':
      return inspectRecordSelection({
        revision: document.revision,
        record: document.textures,
        ids: request.ids,
        label: 'texture'
      });
    case 'clip':
      return inspectClipRequest(document, request);
    case 'activity':
      return inspectActivityPage(
        document,
        activity,
        request.cursor,
        request.limit
      );
    case 'target':
      return inspectTarget(
        document,
        report,
        assets,
        visualReviews
      );
    case 'finding':
      return inspectFinding(document, report, request.path);
  }
};
