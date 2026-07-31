import type {
  AnimationClip,
  AnimationScalar,
  AnimationTriggerTrack,
  AnimationVec3,
  ProjectDocument,
  ProjectFormatProfile,
  TransformChannel
} from '../model';

export type AnimationPreviewIssueCode =
  | 'molang'
  | 'easing'
  | 'split_value'
  | 'entity_rotation'
  | 'start_delay'
  | 'loop_delay'
  | 'animation_time_update'
  | 'blend_weight'
  | 'override_previous_animation'
  | 'sound_trigger'
  | 'particle_trigger'
  | 'timeline_trigger';

export interface AnimationPreviewIssue {
  code: AnimationPreviewIssueCode;
  clipId?: string;
  channelId?: string;
  triggerId?: string;
  keyframeId?: string;
}

export type AnimationExportTarget = ProjectFormatProfile['id'];

export type AnimationExportIssueCode =
  | 'animations_unsupported'
  | 'channels_missing'
  | 'channel_keys_missing'
  | 'molang'
  | 'easing'
  | 'split_value'
  | 'entity_rotation'
  | 'start_delay'
  | 'loop_delay'
  | 'animation_time_update'
  | 'blend_weight'
  | 'override_previous_animation'
  | 'sound_trigger'
  | 'particle_trigger'
  | 'timeline_trigger'
  | 'mixed_interpolation'
  | 'timestamp_collision'
  | 'geckolib_multi_value';

export interface AnimationExportIssue {
  code: AnimationExportIssueCode;
  targetId: AnimationExportTarget;
  clipId: string;
  path: string;
  message: string;
  channelId?: string;
  triggerId?: string;
  keyframeId?: string;
}

export type AnimationExportAdaptationDisposition =
  | 'omitted'
  | 'converted';

export type AnimationExportAdaptationCode =
  | 'animations_unsupported'
  | 'channels_missing'
  | 'channel_keys_missing'
  | 'start_delay'
  | 'loop_delay'
  | 'animation_time_update'
  | 'blend_weight'
  | 'override_previous_animation'
  | 'sound_trigger'
  | 'particle_trigger'
  | 'timeline_trigger';

export interface AnimationExportAdaptation {
  disposition: AnimationExportAdaptationDisposition;
  code: AnimationExportAdaptationCode;
  targetId: AnimationExportTarget;
  clipId: string;
  path: string;
  message: string;
  channelId?: string;
  triggerId?: string;
  keyframeId?: string;
}

export interface ClipAnimationCapability {
  clipId: string;
  previewable: boolean;
  exportable: boolean;
  previewIssues: readonly AnimationPreviewIssue[];
  exportIssues: readonly AnimationExportIssue[];
  exportAdaptations: readonly AnimationExportAdaptation[];
}

export interface ProjectAnimationCapabilityReport {
  targetId: AnimationExportTarget;
  previewable: boolean;
  exportable: boolean;
  clips: readonly ClipAnimationCapability[];
}

const numericScalar = (value: AnimationScalar): boolean =>
  typeof value === 'number' && Number.isFinite(value);

const numericVector = (value: AnimationVec3): boolean =>
  value.every(numericScalar);

export const animationPreviewIssues = (
  channel: TransformChannel
): readonly AnimationPreviewIssue[] => {
  const issues: AnimationPreviewIssue[] = [];
  if (
    channel.property === 'rotation' &&
    channel.rotationSpace === 'entity'
  ) {
    issues.push({
      code: 'entity_rotation',
      channelId: channel.id
    });
  }
  for (const keyframe of channel.keys) {
    if (!numericVector(keyframe.value)) {
      issues.push({
        code: 'molang',
        channelId: channel.id,
        keyframeId: keyframe.id
      });
    }
    if (keyframe.easing !== undefined) {
      issues.push({
        code: 'easing',
        channelId: channel.id,
        keyframeId: keyframe.id
      });
    }
    if (
      keyframe.preValue !== undefined ||
      keyframe.postValue !== undefined
    ) {
      issues.push({
        code: 'split_value',
        channelId: channel.id,
        keyframeId: keyframe.id
      });
    }
  }
  return issues;
};

export const analyzeAnimationPreview = (
  clip: AnimationClip
): readonly AnimationPreviewIssue[] => {
  const issues: AnimationPreviewIssue[] = Object.values(clip.channels)
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((channel) =>
      animationPreviewIssues(channel).map((issue) => ({
        ...issue,
        clipId: clip.id
      }))
    );
  if (clip.startDelay !== undefined) {
    issues.push({ code: 'start_delay', clipId: clip.id });
  }
  if (clip.loopDelay !== undefined) {
    issues.push({ code: 'loop_delay', clipId: clip.id });
  }
  if (clip.animationTimeUpdate !== undefined) {
    issues.push({ code: 'animation_time_update', clipId: clip.id });
  }
  if (clip.blendWeight !== undefined && clip.blendWeight !== 1) {
    issues.push({ code: 'blend_weight', clipId: clip.id });
  }
  if (clip.overridePreviousAnimation === true) {
    issues.push({
      code: 'override_previous_animation',
      clipId: clip.id
    });
  }
  for (const trigger of Object.values(clip.triggers).sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    if (trigger.keys.length === 0) continue;
    issues.push({
      code: triggerIssueCode(trigger),
      clipId: clip.id,
      triggerId: trigger.id
    });
  }
  return issues;
};

const channelUsesMolang = (channel: TransformChannel): boolean =>
  channel.keys.some((keyframe) =>
    [
      ...keyframe.value,
      ...(keyframe.preValue ?? []),
      ...(keyframe.postValue ?? []),
      ...(keyframe.easing?.arguments ?? [])
    ].some((value) => !numericScalar(value))
  );

const minecraftTimestampKey = (timeSeconds: number): string =>
  String(Number(timeSeconds.toFixed(4)));

const timestampCollisionIndexes = (
  times: readonly number[]
): readonly number[] => {
  const seen = new Set<string>();
  const collisions: number[] = [];
  times.forEach((timeSeconds, index) => {
    if (!Number.isFinite(timeSeconds)) return;
    const key = minecraftTimestampKey(timeSeconds);
    if (seen.has(key)) collisions.push(index);
    seen.add(key);
  });
  return collisions;
};

const issue = (
  targetId: AnimationExportTarget,
  clip: AnimationClip,
  code: AnimationExportIssueCode,
  path: string,
  message: string,
  ids: Pick<
    AnimationExportIssue,
    'channelId' | 'triggerId' | 'keyframeId'
  > = {}
): AnimationExportIssue => ({
  code,
  targetId,
  clipId: clip.id,
  path,
  message,
  ...ids
});

const adaptation = (
  targetId: AnimationExportTarget,
  clip: AnimationClip,
  disposition: AnimationExportAdaptationDisposition,
  code: AnimationExportAdaptationCode,
  path: string,
  message: string,
  ids: Pick<
    AnimationExportAdaptation,
    'channelId' | 'triggerId' | 'keyframeId'
  > = {}
): AnimationExportAdaptation => ({
  disposition,
  code,
  targetId,
  clipId: clip.id,
  path,
  message,
  ...ids
});

const triggerIssueCode = (
  trigger: AnimationTriggerTrack
): 'sound_trigger' | 'particle_trigger' | 'timeline_trigger' =>
  `${trigger.type}_trigger`;

const analyzeGltfClip = (
  clip: AnimationClip,
  targetId: AnimationExportTarget
): readonly AnimationExportIssue[] => {
  const issues: AnimationExportIssue[] = [];
  const clipPath = `animations.${clip.id}`;

  for (const channel of Object.values(clip.channels).sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    const channelPath = `${clipPath}.channels.${channel.id}`;
    if (channel.keys.length === 0) {
      continue;
    }
    if (
      channel.property === 'rotation' &&
      channel.rotationSpace === 'entity'
    ) {
      issues.push(issue(
        targetId,
        clip,
        'entity_rotation',
        `${channelPath}.rotationSpace`,
        'glTF animation rotations must be node-local.',
        { channelId: channel.id }
      ));
    }
    if (channelUsesMolang(channel)) {
      issues.push(issue(
        targetId,
        clip,
        'molang',
        `${channelPath}.keys`,
        'glTF animation values must be finite numbers; Molang is Minecraft-specific.',
        { channelId: channel.id }
      ));
    }
    const firstInterpolation = channel.keys[0].interpolation;
    if (
      channel.keys.some(
        (keyframe) => keyframe.interpolation !== firstInterpolation
      )
    ) {
      issues.push(issue(
        targetId,
        clip,
        'mixed_interpolation',
        `${channelPath}.keys`,
        'A glTF sampler requires one interpolation mode per channel.',
        { channelId: channel.id }
      ));
    }
    for (const keyframe of channel.keys) {
      const keyPath = `${channelPath}.keys.${keyframe.id}`;
      if (keyframe.easing !== undefined) {
        issues.push(issue(
          targetId,
          clip,
          'easing',
          `${keyPath}.easing`,
          'Core glTF cannot preserve GeckoLib keyframe easing.',
          { channelId: channel.id, keyframeId: keyframe.id }
        ));
      }
      if (
        keyframe.preValue !== undefined ||
        keyframe.postValue !== undefined
      ) {
        issues.push(issue(
          targetId,
          clip,
          'split_value',
          keyPath,
          'Core glTF cannot preserve split pre/post keyframe values.',
          { channelId: channel.id, keyframeId: keyframe.id }
        ));
      }
    }
  }
  return issues;
};

const analyzeGltfClipAdaptations = (
  clip: AnimationClip,
  targetId: AnimationExportTarget
): readonly AnimationExportAdaptation[] => {
  const adaptations: AnimationExportAdaptation[] = [];
  const clipPath = `animations.${clip.id}`;
  if (Object.keys(clip.channels).length === 0) {
    adaptations.push(adaptation(
      targetId,
      clip,
      'omitted',
      'channels_missing',
      `${clipPath}.channels`,
      'The clip has no transform channels, so core glTF omits the empty animation while the ashfox project keeps it.'
    ));
  }
  if (clip.startDelay !== undefined) {
    adaptations.push(adaptation(
      targetId,
      clip,
      'omitted',
      'start_delay',
      `${clipPath}.startDelay`,
      'Core glTF has no playback start-delay contract; the export omits it while the ashfox project keeps it.'
    ));
  }
  if (clip.loopDelay !== undefined) {
    adaptations.push(adaptation(
      targetId,
      clip,
      'omitted',
      'loop_delay',
      `${clipPath}.loopDelay`,
      'Core glTF has no playback loop-delay contract; the export omits it while the ashfox project keeps it.'
    ));
  }
  if (clip.animationTimeUpdate !== undefined) {
    adaptations.push(adaptation(
      targetId,
      clip,
      'omitted',
      'animation_time_update',
      `${clipPath}.animationTimeUpdate`,
      'Core glTF has no custom playback-time expression; the export omits it while the ashfox project keeps it.'
    ));
  }
  if (clip.blendWeight !== undefined && clip.blendWeight !== 1) {
    adaptations.push(adaptation(
      targetId,
      clip,
      'omitted',
      'blend_weight',
      `${clipPath}.blendWeight`,
      'Core glTF has no clip blend-weight contract; the export omits it while the ashfox project keeps it.'
    ));
  }
  if (clip.overridePreviousAnimation === true) {
    adaptations.push(adaptation(
      targetId,
      clip,
      'omitted',
      'override_previous_animation',
      `${clipPath}.overridePreviousAnimation`,
      'Core glTF has no animation override contract; the export omits it while the ashfox project keeps it.'
    ));
  }
  for (const trigger of Object.values(clip.triggers).sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    if (trigger.keys.length === 0) continue;
    adaptations.push(adaptation(
      targetId,
      clip,
      'omitted',
      triggerIssueCode(trigger),
      `${clipPath}.triggers.${trigger.id}`,
      `Core glTF has no ${trigger.type} trigger contract; the export omits this track while the ashfox project keeps it.`,
      { triggerId: trigger.id }
    ));
  }
  for (const channel of Object.values(clip.channels).sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    if (channel.keys.length > 0) continue;
    adaptations.push(adaptation(
      targetId,
      clip,
      'omitted',
      'channel_keys_missing',
      `${clipPath}.channels.${channel.id}.keys`,
      'The transform channel has no keyframes, so core glTF omits it while the ashfox project keeps it.',
      { channelId: channel.id }
    ));
  }
  return adaptations;
};

const analyzeMinecraftClip = (
  clip: AnimationClip,
  targetId: 'minecraft.bedrock' | 'minecraft.java.geckolib5'
): readonly AnimationExportIssue[] => {
  const issues: AnimationExportIssue[] = [];
  const clipPath = `animations.${clip.id}`;
  for (const channel of Object.values(clip.channels).sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    const channelPath = `${clipPath}.channels.${channel.id}`;
    if (targetId === 'minecraft.bedrock') {
      for (const keyframe of channel.keys) {
        if (
          keyframe.interpolation === 'step' ||
          keyframe.easing !== undefined
        ) {
          issues.push(issue(
            targetId,
            clip,
            'easing',
            `${channelPath}.keys.${keyframe.id}`,
            'Bedrock animation 1.8.0 supports linear or Catmull-Rom keys, not STEP or GeckoLib easing.',
            { channelId: channel.id, keyframeId: keyframe.id }
          ));
        }
      }
    }
    for (const index of timestampCollisionIndexes(
      channel.keys.map((keyframe) => keyframe.timeSeconds)
    )) {
      const keyframe = channel.keys[index];
      issues.push(issue(
        targetId,
        clip,
        'timestamp_collision',
        `${channelPath}.keys.${keyframe.id}.timeSeconds`,
        'Minecraft timestamp rounding would overwrite another transform key.',
        { channelId: channel.id, keyframeId: keyframe.id }
      ));
    }
  }

  const triggerTimesByType = new Map<
    AnimationTriggerTrack['type'],
    Array<{ trigger: AnimationTriggerTrack; keyIndex: number }>
  >();
  for (const trigger of Object.values(clip.triggers).sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    const entries = triggerTimesByType.get(trigger.type) ?? [];
    entries.push(
      ...trigger.keys.map((_, keyIndex) => ({ trigger, keyIndex }))
    );
    triggerTimesByType.set(trigger.type, entries);
    if (targetId === 'minecraft.java.geckolib5') {
      for (const keyframe of trigger.keys) {
        if (!Array.isArray(keyframe.value)) continue;
        issues.push(issue(
          targetId,
          clip,
          'geckolib_multi_value',
          `${clipPath}.triggers.${trigger.id}.keys.${keyframe.id}.value`,
          `GeckoLib 5 ${trigger.type} timestamps require one decoded value.`,
          { triggerId: trigger.id, keyframeId: keyframe.id }
        ));
      }
    }
  }
  for (const entries of triggerTimesByType.values()) {
    const collisionIndexes = timestampCollisionIndexes(
      entries.map(
        ({ trigger, keyIndex }) =>
          trigger.keys[keyIndex].timeSeconds
      )
    );
    for (const index of collisionIndexes) {
      const { trigger, keyIndex } = entries[index];
      const keyframe = trigger.keys[keyIndex];
      issues.push(issue(
        targetId,
        clip,
        'timestamp_collision',
        `${clipPath}.triggers.${trigger.id}.keys.${keyframe.id}.timeSeconds`,
        'Minecraft timestamp rounding would overwrite another effect key of the same type.',
        { triggerId: trigger.id, keyframeId: keyframe.id }
      ));
    }
  }
  return issues;
};

export const analyzeAnimationExport = (
  clip: AnimationClip,
  targetId: AnimationExportTarget
): readonly AnimationExportIssue[] => {
  switch (targetId) {
    case 'ashfox.generic':
      return [];
    case 'minecraft.java_block':
      return [];
    case 'minecraft.bedrock':
    case 'minecraft.java.geckolib5':
      return analyzeMinecraftClip(clip, targetId);
    case 'gltf.2':
      return analyzeGltfClip(clip, targetId);
  }
};

export const analyzeAnimationExportAdaptations = (
  clip: AnimationClip,
  targetId: AnimationExportTarget
): readonly AnimationExportAdaptation[] => {
  switch (targetId) {
    case 'ashfox.generic':
    case 'minecraft.bedrock':
    case 'minecraft.java.geckolib5':
      return [];
    case 'minecraft.java_block':
      return [adaptation(
        targetId,
        clip,
        'omitted',
        'animations_unsupported',
        `animations.${clip.id}`,
        'Java block models are static, so this export omits the animation clip while the ashfox project keeps it.'
      )];
    case 'gltf.2':
      return analyzeGltfClipAdaptations(clip, targetId);
  }
};

const NON_TRANSFORM_PREVIEW_ISSUES = new Set<
  AnimationPreviewIssueCode
>([
  'sound_trigger',
  'particle_trigger',
  'timeline_trigger'
]);

export const blockingAnimationPreviewIssues = (
  clip: AnimationClip,
  targetId: AnimationExportTarget
): readonly AnimationPreviewIssue[] => {
  if (targetId === 'minecraft.java_block') return [];
  const omittedByTarget = new Set<string>(
    analyzeAnimationExportAdaptations(clip, targetId)
      .filter((item) => item.disposition === 'omitted')
      .map((item) => item.code)
  );
  return analyzeAnimationPreview(clip).filter(
    (item) =>
      !NON_TRANSFORM_PREVIEW_ISSUES.has(item.code) &&
      !omittedByTarget.has(item.code)
  );
};

export const analyzeClipAnimationCapability = (
  clip: AnimationClip,
  targetId: AnimationExportTarget
): ClipAnimationCapability => {
  const previewIssues = blockingAnimationPreviewIssues(clip, targetId);
  const exportIssues = analyzeAnimationExport(clip, targetId);
  const exportAdaptations = analyzeAnimationExportAdaptations(
    clip,
    targetId
  );
  return {
    clipId: clip.id,
    previewable: previewIssues.length === 0,
    exportable: exportIssues.length === 0,
    previewIssues,
    exportIssues,
    exportAdaptations
  };
};

export const analyzeProjectAnimationCapabilities = (
  document: ProjectDocument
): ProjectAnimationCapabilityReport => {
  const targetId = document.formatProfile.id;
  const clips = Object.values(document.animations)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((clip) => analyzeClipAnimationCapability(clip, targetId));
  return {
    targetId,
    previewable: clips.every((clip) => clip.previewable),
    exportable: clips.every((clip) => clip.exportable),
    clips
  };
};

export class AnimationExportCapabilityError extends Error {
  readonly code = 'animation.export_unsupported' as const;

  constructor(readonly issues: readonly AnimationExportIssue[]) {
    const first = issues[0];
    super(
      first
        ? `${first.message} (${first.code} at ${first.path})`
        : 'The animation cannot be exported by the selected target.'
    );
    this.name = 'AnimationExportCapabilityError';
  }
}

export const assertProjectAnimationsExportable = (
  document: ProjectDocument
): void => {
  const report = analyzeProjectAnimationCapabilities(document);
  const issues = report.clips.flatMap((clip) => clip.exportIssues);
  if (issues.length > 0) {
    throw new AnimationExportCapabilityError(issues);
  }
};
