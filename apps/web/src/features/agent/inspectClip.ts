import {
  CANONICAL_IDLE_CLIP_ID,
  readCompiledParts,
  type AnimationClip,
  type ProjectDocument
} from '@ashfox/engine-core';

import { canonicalFingerprint } from '../../application/canonicalFingerprint';

export const CLIP_INSPECT_MAX_LIMIT = 25;

const DEFAULT_LIMIT = 20;

const canonicalFrame = (
  timeSeconds: number
): number | null => {
  const frame = timeSeconds * 20;
  const rounded = Math.round(frame);
  return (
    Number.isSafeInteger(rounded) &&
    Math.abs(frame - rounded) <= 0.000001
  )
    ? rounded
    : null;
};

const pageOffset = (
  cursor: string | undefined,
  scope: string
): number | null => {
  if (cursor === undefined) return 0;
  const match = cursor.match(
    new RegExp(`^clip:${scope}:([0-9a-z]+)$`)
  );
  if (!match) return null;
  const offset = Number.parseInt(match[1], 36);
  return Number.isSafeInteger(offset) && offset >= 0
    ? offset
    : null;
};

const valueSignature = (
  value: AnimationClip['channels'][string]['keys'][number]['value']
): string =>
  JSON.stringify(value);

const authoringVector = (
  value: AnimationClip['channels'][string]['keys'][number]['value']
): readonly unknown[] =>
  value.map((component) =>
    typeof component === 'number'
      ? component
      : { expression: true }
  );

const channelSummary = (
  channel: AnimationClip['channels'][string],
  partIdByBoneId: ReadonlyMap<string, string>
): unknown => {
  const keys = [...channel.keys].sort(
    (left, right) =>
      left.timeSeconds - right.timeSeconds ||
      left.id.localeCompare(right.id)
  );
  const opening = keys[0] ?? null;
  const closing = keys.at(-1) ?? null;
  const openingSignature = opening
    ? valueSignature(opening.value)
    : null;
  return {
    trackId: channel.id,
    partId: partIdByBoneId.get(channel.targetNodeId) ?? null,
    targetNodeId: channel.targetNodeId,
    property: channel.property,
    keyCount: keys.length,
    firstFrame:
      opening ? canonicalFrame(opening.timeSeconds) : null,
    lastFrame:
      closing ? canonicalFrame(closing.timeSeconds) : null,
    openingValue:
      opening ? authoringVector(opening.value) : null,
    closingValue:
      closing ? authoringVector(closing.value) : null,
    moving:
      openingSignature !== null &&
      keys.some(
        (key) =>
          valueSignature(key.value) !== openingSignature
      ),
    interpolations: [
      ...new Set(keys.map((key) => key.interpolation))
    ].sort()
  };
};

const keyItems = (
  clip: AnimationClip,
  trackId: string
): readonly unknown[] =>
  [...clip.channels[trackId].keys]
    .sort(
      (left, right) =>
        left.timeSeconds - right.timeSeconds ||
        left.id.localeCompare(right.id)
    )
    .map((key) => ({
      keyId: key.id,
      frame: canonicalFrame(key.timeSeconds),
      timeSeconds: key.timeSeconds,
      value: authoringVector(key.value),
      ...(key.preValue === undefined
        ? {}
        : { preValue: authoringVector(key.preValue) }),
      ...(key.postValue === undefined
        ? {}
        : { postValue: authoringVector(key.postValue) }),
      interpolation: key.interpolation,
      ...(key.easing === undefined
        ? {}
        : {
            easing: {
              type: key.easing.type.slice(0, 120),
              argumentCount:
                key.easing.arguments?.length ?? 0
            }
          })
    }));

const clipUsesCanonical20Fps = (
  clip: AnimationClip
): boolean =>
  clip.fps === 20 &&
  canonicalFrame(clip.durationSeconds) !== null &&
  Object.values(clip.channels).every(
    (channel) =>
      channel.keys.every(
        (key) => canonicalFrame(key.timeSeconds) !== null
      )
  ) &&
  Object.values(clip.triggers).every(
    (trigger) =>
      trigger.keys.every(
        (key) => canonicalFrame(key.timeSeconds) !== null
      )
  );

export const inspectClipAuthoring = (
  document: ProjectDocument,
  clip: AnimationClip,
  trackId: string | undefined,
  cursor: string | undefined,
  limit = DEFAULT_LIMIT
): unknown | null => {
  const scope = canonicalFingerprint({
    projectId: document.id,
    revision: document.revision,
    clipId: clip.id,
    trackId: trackId ?? ''
  }).split(':')[1];
  const offset = pageOffset(cursor, scope);
  if (offset === null) return null;
  const compiled = readCompiledParts(document);
  const partIdByBoneId = new Map(
    compiled.ok
      ? [...compiled.parts.values()].map(
          (part) => [part.bone.id, part.partId]
        )
      : []
  );
  const channel = trackId
    ? clip.channels[trackId]
    : undefined;
  const sourceItems = trackId
    ? keyItems(clip, trackId)
    : Object.values(clip.channels)
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((item) =>
          channelSummary(item, partIdByBoneId)
        );
  const items = sourceItems.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  return {
    clip: {
      id: clip.id,
      name: clip.name,
      role:
        clip.id === CANONICAL_IDLE_CLIP_ID
          ? 'idle'
          : clip.loop === 'loop'
            ? 'loop'
            : 'once',
      loopMode: clip.loop,
      durationFrames: canonicalFrame(clip.durationSeconds),
      durationSeconds: clip.durationSeconds,
      fps: clip.fps,
      canonical20Fps: clipUsesCanonical20Fps(clip),
      channelCount: Object.keys(clip.channels).length,
      triggerCount: Object.keys(clip.triggers).length
    },
    page: {
      kind: channel ? 'keys' : 'tracks',
      ...(channel
        ? {
            track: channelSummary(
              channel,
              partIdByBoneId
            )
          }
        : {}),
      items,
      total: sourceItems.length,
      nextCursor:
        nextOffset < sourceItems.length
          ? `clip:${scope}:${nextOffset.toString(36)}`
          : null
    }
  };
};
