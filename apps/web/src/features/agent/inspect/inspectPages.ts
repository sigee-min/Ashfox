import {
  readPartRecipe,
  type CommandReceipt,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  boundedSuccess
} from '../boundedResult';
import {
  schemaHash
} from '../schemaHash';
import type {
  InspectResult
} from '../types';
import {
  DETAIL_INSPECT_LIMIT,
  invalidInspectRequest
} from './inspectResult';

const CATALOG_PAGE_LIMIT = 50;
const ACTIVITY_PAGE_LIMIT = 20;

const pageScope = (document: ProjectDocument): string =>
  schemaHash({
    projectId: document.id,
    revision: document.revision
  }).split(':')[1];

const pageOffset = (
  cursor: string | undefined,
  kind: 'catalog' | 'activity',
  scope: string
): number | null => {
  if (cursor === undefined) return 0;
  const match = cursor.match(
    new RegExp(`^${kind}:${scope}:([0-9a-z]+)$`)
  );
  if (!match) return null;
  const offset = Number.parseInt(match[1], 36);
  return Number.isSafeInteger(offset) && offset >= 0
    ? offset
    : null;
};

export const inspectCatalogPage = (
  document: ProjectDocument,
  cursor: string | undefined,
  limit = CATALOG_PAGE_LIMIT
): InspectResult => {
  const scope = pageScope(document);
  const offset = pageOffset(cursor, 'catalog', scope);
  if (offset === null) {
    return invalidInspectRequest(
      document.revision,
      'cursor',
      'catalog page cursor from the previous response'
    );
  }
  const recipe = readPartRecipe(document);
  const entries = [
    ...(
      recipe.ok && recipe.recipe
        ? recipe.recipe.parts
          .map((part) => part.partId)
          .sort()
          .map((id) => ({ kind: 'part' as const, id }))
        : []
    ),
    ...Object.keys(document.textures)
      .sort()
      .map((id) => ({ kind: 'texture' as const, id })),
    ...Object.keys(document.animations)
      .sort()
      .map((id) => ({ kind: 'clip' as const, id }))
  ];
  const items = entries.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  return boundedSuccess(
    document.revision,
    {
      items,
      total: entries.length,
      counts: {
        parts: entries.filter((entry) => entry.kind === 'part').length,
        textures:
          entries.filter((entry) => entry.kind === 'texture').length,
        clips: entries.filter((entry) => entry.kind === 'clip').length
      },
      nextCursor:
        nextOffset < entries.length
          ? `catalog:${scope}:${nextOffset.toString(36)}`
          : null
    },
    DETAIL_INSPECT_LIMIT
  );
};

export const inspectActivityPage = (
  document: ProjectDocument,
  activity: readonly CommandReceipt[],
  cursor: string | undefined,
  limit = ACTIVITY_PAGE_LIMIT
): InspectResult => {
  const scope = pageScope(document);
  const offset = pageOffset(cursor, 'activity', scope);
  if (offset === null) {
    return invalidInspectRequest(
      document.revision,
      'cursor',
      'activity page cursor from the previous response'
    );
  }
  const items = activity
    .slice(offset, offset + limit)
    .map((receipt) => ({
      commandId: receipt.commandId,
      projectId: receipt.projectId,
      actorId: receipt.actorId,
      source: receipt.source,
      summary: receipt.summary.slice(0, 500),
      beforeRevision: receipt.beforeRevision,
      revision: receipt.revision,
      completedAt: receipt.completedAt,
      durationMs: receipt.durationMs,
      effects: {
        created: receipt.effects.createdEntityIds.length,
        changed: receipt.effects.changedEntityIds.length,
        removed: receipt.effects.removedEntityIds.length,
        invalidated: receipt.effects.invalidated
      },
      findings: {
        errors: receipt.findings.filter(
          (finding) => finding.severity === 'error'
        ).length,
        warnings: receipt.findings.filter(
          (finding) => finding.severity === 'warning'
        ).length
      }
    }));
  const nextOffset = offset + items.length;
  return boundedSuccess(
    document.revision,
    {
      items,
      total: activity.length,
      nextCursor:
        nextOffset < activity.length
          ? `activity:${scope}:${nextOffset.toString(36)}`
          : null
    },
    DETAIL_INSPECT_LIMIT
  );
};
