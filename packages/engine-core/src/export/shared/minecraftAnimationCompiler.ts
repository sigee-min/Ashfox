import {
  assertProjectAnimationsExportable
} from '../../animation/capability';
import type {
  AnimationClip,
  ProjectDocument
} from '../../model';
import {
  effectivelyVisibleSceneNodeIds
} from '../../sceneVisibility';
import { compileMinecraftAnimationChannel } from './minecraftAnimationChannel';
import { minecraftActorAnimationNames } from './minecraftAnimationNames';
import { compileMinecraftAnimationTriggers } from './minecraftAnimationTriggers';
import type {
  MinecraftActorAnimation,
  MinecraftActorAnimationFile,
  MinecraftAnimationCompileOptions,
  MinecraftBoneAnimation
} from './minecraftAnimationTypes';
import { serializeAnimationScalar } from './minecraftAnimationValues';

const compileClip = (
  document: ProjectDocument,
  clip: AnimationClip,
  options: MinecraftAnimationCompileOptions,
  visibleNodeIds: ReadonlySet<string>
): MinecraftActorAnimation => {
  const bones: Record<string, MinecraftBoneAnimation> = {};
  const channels = Object.values(clip.channels).sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  for (const channel of channels) {
    const target = document.scene.nodes[channel.targetNodeId];
    if (
      !target ||
      target.kind !== 'bone' ||
      !visibleNodeIds.has(target.id)
    ) {
      continue;
    }
    const bone = bones[target.name] ?? {};
    const compiled = compileMinecraftAnimationChannel(channel, options);
    if (
      channel.property === 'rotation' &&
      channel.rotationSpace === 'entity'
    ) {
      bone.relative_to =
        options.dialect === 'bedrock'
          ? { rotation: 'entity' }
          : 'entity';
    }
    bone[channel.property] = compiled;
    bones[target.name] = bone;
  }

  return {
    ...(clip.loop === 'loop'
      ? { loop: true as const }
      : clip.loop === 'hold_on_last_frame'
        ? { loop: 'hold_on_last_frame' as const }
        : {}),
    animation_length: clip.durationSeconds,
    ...(clip.startDelay
      ? { start_delay: clip.startDelay.source }
      : {}),
    ...(clip.loopDelay
      ? { loop_delay: clip.loopDelay.source }
      : {}),
    ...(clip.animationTimeUpdate
      ? { anim_time_update: clip.animationTimeUpdate.source }
      : {}),
    ...(clip.blendWeight !== undefined
      ? {
          blend_weight: serializeAnimationScalar(
            clip.blendWeight,
            false
          )
        }
      : {}),
    ...(clip.overridePreviousAnimation !== undefined
      ? {
          override_previous_animation:
            clip.overridePreviousAnimation
        }
      : {}),
    ...(Object.keys(bones).length > 0 ? { bones } : {}),
    ...compileMinecraftAnimationTriggers(
      document,
      Object.values(clip.triggers).sort((left, right) =>
        left.id.localeCompare(right.id)
      ),
      options,
      visibleNodeIds
    )
  };
};

export const buildMinecraftActorAnimation = (
  document: ProjectDocument,
  options: MinecraftAnimationCompileOptions
): MinecraftActorAnimationFile => {
  assertProjectAnimationsExportable(document);
  const visibleNodeIds = effectivelyVisibleSceneNodeIds(document);
  const animationNames = minecraftActorAnimationNames(document);
  const animations: Record<string, MinecraftActorAnimation> = {};
  for (const clip of Object.values(document.animations).sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    animations[animationNames.get(clip.id) ?? clip.name] = compileClip(
      document,
      clip,
      options,
      visibleNodeIds
    );
  }
  return {
    format_version: options.formatVersion,
    animations
  };
};
