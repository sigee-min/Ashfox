import type {
  AnimationEffect,
  AnimationEffectValue,
  ProjectDocument
} from '../../model';
import { compareStableText } from '../../stableOrder';

export interface SceneNodeRemoval {
  document: ProjectDocument;
  removedNodeIds: readonly string[];
  removedEntityIds: readonly string[];
  changedEntityIds: readonly string[];
}

const collectDescendants = (
  document: ProjectDocument,
  nodeIds: readonly string[]
): ReadonlySet<string> => {
  const removed = new Set(nodeIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of Object.values(document.scene.nodes)) {
      if (
        node.parentId &&
        removed.has(node.parentId) &&
        !removed.has(node.id)
      ) {
        removed.add(node.id);
        changed = true;
      }
    }
  }
  return removed;
};

const clearLocator = (
  effect: AnimationEffect,
  removed: ReadonlySet<string>
): AnimationEffect => {
  if (!effect.locatorId || !removed.has(effect.locatorId)) return effect;
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
  removed: ReadonlySet<string>
): AnimationEffectValue =>
  isEffectArray(value)
    ? value.map((effect) => clearLocator(effect, removed))
    : clearLocator(value, removed);

interface AnimationReferenceRemoval {
  animations: ProjectDocument['animations'];
  removedIds: readonly string[];
  changedIds: readonly string[];
}

const triggerUsesRemovedLocator = (
  value: AnimationEffectValue,
  removed: ReadonlySet<string>
): boolean => {
  const effects = isEffectArray(value) ? value : [value];
  return effects.some(
    (effect) =>
      effect.locatorId !== undefined &&
      removed.has(effect.locatorId)
  );
};

const removeAnimationReferences = (
  document: ProjectDocument,
  removed: ReadonlySet<string>
): AnimationReferenceRemoval => {
  const removedIds: string[] = [];
  const changedIds: string[] = [];
  const animations = Object.fromEntries(
    Object.entries(document.animations).flatMap(([clipId, clip]) => {
      const removedChannelIds = Object.values(clip.channels)
        .filter((channel) => removed.has(channel.targetNodeId))
        .map((channel) => channel.id);
      const channels = Object.fromEntries(
        Object.entries(clip.channels).filter(
          ([, channel]) => !removed.has(channel.targetNodeId)
        )
      );
      const changedTriggerIds: string[] = [];
      const triggers = Object.fromEntries(
        Object.entries(clip.triggers).map(([triggerId, trigger]) => {
          if (trigger.type === 'timeline') return [triggerId, trigger];
          if (
            trigger.keys.some((key) =>
              triggerUsesRemovedLocator(key.value, removed)
            )
          ) {
            changedTriggerIds.push(triggerId);
          }
          return [
            triggerId,
            {
              ...trigger,
              keys: trigger.keys.map((key) => ({
                ...key,
                value: clearEffectLocators(key.value, removed)
              }))
            }
          ];
        })
      );
      if (
        Object.keys(channels).length === 0 &&
        Object.keys(triggers).length === 0 &&
        (
          Object.keys(clip.channels).length > 0 ||
          Object.keys(clip.triggers).length > 0
        )
      ) {
        removedIds.push(clipId, ...removedChannelIds);
        return [];
      }
      removedIds.push(...removedChannelIds);
      if (
        removedChannelIds.length > 0 ||
        changedTriggerIds.length > 0
      ) {
        changedIds.push(clipId, ...changedTriggerIds);
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
  return {
    animations,
    removedIds: [...new Set(removedIds)].sort(compareStableText),
    changedIds: [...new Set(changedIds)]
      .filter((id) => !removedIds.includes(id))
      .sort(compareStableText)
  };
};

export const removeSceneNodes = (
  document: ProjectDocument,
  nodeIds: readonly string[]
): SceneNodeRemoval => {
  const removed = collectDescendants(document, nodeIds);
  const animationRemoval = removeAnimationReferences(document, removed);
  const removedNodeIds = [...removed].sort(compareStableText);
  return {
    document: {
      ...document,
      scene: {
        roots: document.scene.roots.filter(
          (nodeId) => !removed.has(nodeId)
        ),
        nodes: Object.fromEntries(
          Object.entries(document.scene.nodes).filter(
            ([nodeId]) => !removed.has(nodeId)
          )
        )
      },
      animations: animationRemoval.animations
    },
    removedNodeIds,
    removedEntityIds: [
      ...new Set([
        ...removedNodeIds,
        ...animationRemoval.removedIds
      ])
    ].sort(compareStableText),
    changedEntityIds: animationRemoval.changedIds
  };
};
