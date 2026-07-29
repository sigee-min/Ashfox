import type { ProjectDocument } from '../../model';
import { updateSceneNode } from '../../scene';
import { defineCommand } from '../definition';
import { entityIdsSchema, nullableEntityIdSchema } from './schemas';
import { findMissingNodeId } from './sceneHelpers';

const inputSchema = {
  type: 'object',
  properties: {
    nodeIds: entityIdsSchema,
    parentId: nullableEntityIdSchema
  },
  required: ['nodeIds', 'parentId'],
  additionalProperties: false
} as const;

const createsCycle = (
  document: ProjectDocument,
  nodeIds: ReadonlySet<string>,
  parentId: string | null
): boolean => {
  let currentId = parentId;
  const visited = new Set<string>();
  while (currentId) {
    if (nodeIds.has(currentId) || visited.has(currentId)) return true;
    visited.add(currentId);
    currentId = document.scene.nodes[currentId]?.parentId ?? null;
  }
  return false;
};

export const reparentNodesCommand = defineCommand({
  name: 'scene.nodes.reparent',
  label: 'Reparent nodes',
  purpose: 'Move scene nodes under one bone or to the scene root.',
  inputSchema,
  apply: (document, payload) => {
    const missingId = findMissingNodeId(document, payload.nodeIds);
    const parent = payload.parentId
      ? document.scene.nodes[payload.parentId]
      : undefined;
    const selected = new Set(payload.nodeIds);
    if (
      missingId ||
      (payload.parentId !== null && parent?.kind !== 'bone') ||
      createsCycle(document, selected, payload.parentId)
    ) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: missingId
            ? `Scene node "${missingId}" does not exist.`
            : 'Parent must be an existing bone outside the selected hierarchy.',
          path: payload.parentId === null ? 'payload.nodeIds' : 'payload.parentId'
        }
      };
    }
    const next = payload.nodeIds.reduce(
      (current, nodeId) =>
        updateSceneNode(current, nodeId, (node) => ({
          ...node,
          parentId: payload.parentId
        })),
      document
    );
    const roots = [
      ...document.scene.roots.filter((nodeId) => !selected.has(nodeId)),
      ...(payload.parentId === null
        ? payload.nodeIds.filter((nodeId) => !document.scene.roots.includes(nodeId))
        : [])
    ];
    return {
      ok: true,
      value: {
        document: {
          ...next,
          scene: {
            ...next.scene,
            roots
          }
        },
        summary: `Reparent ${payload.nodeIds.length} node${payload.nodeIds.length === 1 ? '' : 's'}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: payload.nodeIds,
          removedEntityIds: [],
          invalidated: ['scene', 'animations', 'validation', 'preview']
        }
      }
    };
  }
});
