import type {
  AnimationEffect,
  AnimationEffectValue,
  ProjectDocument
} from '../../model';
import { surfaceDetailIds } from '../../textures/surfaceDetails';
import { defineCommand } from '../definition';
import { entityIdsSchema } from './schemas';
import { findMissingNodeId } from './sceneHelpers';

const inputSchema = {
  type: 'object',
  properties: {
    nodeIds: entityIdsSchema
  },
  required: ['nodeIds'],
  additionalProperties: false
} as const;

const collectDescendants = (
  document: ProjectDocument,
  nodeIds: readonly string[]
): ReadonlySet<string> => {
  const deleted = new Set(nodeIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of Object.values(document.scene.nodes)) {
      if (node.parentId && deleted.has(node.parentId) && !deleted.has(node.id)) {
        deleted.add(node.id);
        changed = true;
      }
    }
  }
  return deleted;
};

const clearLocator = (
  effect: AnimationEffect,
  deleted: ReadonlySet<string>
): AnimationEffect => {
  if (!effect.locatorId || !deleted.has(effect.locatorId)) return effect;
  return {
    effect: effect.effect,
    ...(effect.preEffectScript
      ? { preEffectScript: effect.preEffectScript }
      : {}),
    ...(effect.bindToActor === undefined
      ? {}
      : { bindToActor: effect.bindToActor })
  };
};

const isEffectArray = (
  value: AnimationEffectValue
): value is readonly AnimationEffect[] => Array.isArray(value);

const clearEffectLocators = (
  value: AnimationEffectValue,
  deleted: ReadonlySet<string>
): AnimationEffectValue =>
  isEffectArray(value)
    ? value.map((effect) => clearLocator(effect, deleted))
    : clearLocator(value, deleted);

const removeAnimationReferences = (
  document: ProjectDocument,
  deleted: ReadonlySet<string>
): ProjectDocument['animations'] =>
  Object.fromEntries(
    Object.entries(document.animations).flatMap(([clipId, clip]) => {
      const channels = Object.fromEntries(
        Object.entries(clip.channels).filter(
          ([, channel]) => !deleted.has(channel.targetNodeId)
        )
      );
      const triggers = Object.fromEntries(
        Object.entries(clip.triggers).map(([triggerId, trigger]) => {
          if (trigger.type === 'timeline') return [triggerId, trigger];
          return [
            triggerId,
            {
              ...trigger,
              keys: trigger.keys.map((key) => ({
                ...key,
                value: clearEffectLocators(key.value, deleted)
              }))
            }
          ];
        })
      );
      if (
        Object.keys(channels).length === 0 &&
        Object.keys(triggers).length === 0
      ) {
        return [];
      }
      return [[
        clipId,
        {
        ...clip,
          channels,
          triggers
        }
      ]];
    })
  );

export const deleteNodesCommand = defineCommand({
  name: 'scene.nodes.delete',
  label: 'Delete nodes',
  purpose: 'Delete scene nodes, their descendants, and dependent animation references.',
  inputSchema,
  apply: (document, payload) => {
    const missingId = findMissingNodeId(document, payload.nodeIds);
    if (missingId) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: `Scene node "${missingId}" does not exist.`,
          path: 'payload.nodeIds'
        }
      };
    }
    const deleted = collectDescendants(document, payload.nodeIds);
    const deletedDetailIds = [...deleted].flatMap((nodeId) => {
      const node = document.scene.nodes[nodeId];
      return node?.kind === 'cube' ? surfaceDetailIds(node.faces) : [];
    });
    const nodes = Object.fromEntries(
      Object.entries(document.scene.nodes).filter(
        ([nodeId]) => !deleted.has(nodeId)
      )
    );
    const next = {
      ...document,
      scene: {
        roots: document.scene.roots.filter((nodeId) => !deleted.has(nodeId)),
        nodes
      },
      animations: removeAnimationReferences(document, deleted)
    };
    return {
      ok: true,
      value: {
        document: next,
        summary: `Delete ${deleted.size} node${deleted.size === 1 ? '' : 's'}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: [],
          removedEntityIds: [...deleted, ...deletedDetailIds],
          invalidated: [
            'scene',
            'textures',
            'uv',
            'animations',
            'validation',
            'preview'
          ]
        }
      }
    };
  }
});
