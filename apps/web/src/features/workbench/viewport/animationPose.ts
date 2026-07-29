import * as THREE from 'three';

import type {
  AnimationScalar,
  ProjectDocument
} from '@ashfox/engine-core';

import {
  applyNodeTransform,
  localNodePosition
} from './sceneTransform';
import type { ProjectSceneProjection } from './sceneTypes';

const numericScalar = (value: AnimationScalar): number | null =>
  typeof value === 'number' ? value : null;

const interpolateChannel = (
  keys: readonly {
    timeSeconds: number;
    value: readonly [AnimationScalar, AnimationScalar, AnimationScalar];
    interpolation: 'linear' | 'step' | 'catmullrom';
  }[],
  time: number
): [number, number, number] | null => {
  if (keys.length === 0) return null;
  const sorted = [...keys].sort(
    (left, right) => left.timeSeconds - right.timeSeconds
  );
  const nextIndex = sorted.findIndex((key) => key.timeSeconds >= time);
  const right = nextIndex < 0 ? sorted.at(-1) : sorted[nextIndex];
  const left =
    nextIndex <= 0 ? sorted[0] : sorted[Math.max(0, nextIndex - 1)];
  if (!left || !right) return null;

  const leftValue = left.value.map(numericScalar);
  const rightValue = right.value.map(numericScalar);
  if (
    leftValue.some((value) => value === null) ||
    rightValue.some((value) => value === null)
  ) {
    return null;
  }

  const duration = right.timeSeconds - left.timeSeconds;
  const factor =
    duration <= 0 || left.interpolation === 'step'
      ? 0
      : Math.min(1, Math.max(0, (time - left.timeSeconds) / duration));

  return [0, 1, 2].map(
    (index) =>
      (leftValue[index] as number) +
      ((rightValue[index] as number) - (leftValue[index] as number)) * factor
  ) as [number, number, number];
};

export const applyAnimationPose = (
  document: ProjectDocument,
  projection: ProjectSceneProjection,
  clipId: string | null,
  timeSeconds: number
): void => {
  for (const node of Object.values(document.scene.nodes)) {
    const object = projection.objectsByNodeId.get(node.id);
    if (object) applyNodeTransform(document, node, object);
  }

  if (!clipId) return;
  const clip = document.animations[clipId];
  if (!clip) return;

  for (const channel of Object.values(clip.channels)) {
    const object = projection.objectsByNodeId.get(channel.targetNodeId);
    const node = document.scene.nodes[channel.targetNodeId];
    if (!object || !node) continue;

    const value = interpolateChannel(channel.keys, timeSeconds);
    if (!value) continue;
    if (channel.property === 'position') {
      object.position.fromArray(localNodePosition(document, node, value));
    } else if (channel.property === 'rotation') {
      object.rotation.set(
        THREE.MathUtils.degToRad(value[0]),
        THREE.MathUtils.degToRad(value[1]),
        THREE.MathUtils.degToRad(value[2])
      );
    } else {
      object.scale.fromArray(value);
    }
  }
};
