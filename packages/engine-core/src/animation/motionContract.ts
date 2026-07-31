export const MOTION_AUTHORING_LIMITS = Object.freeze({
  maxMotionsPerOperation: 128,
  maxKeysPerMotion: 64,
  maxKeysPerOperation: 1_024,
  maxKeysPerBatch: 2_048
});

interface MotionKeyCollection {
  keys: readonly unknown[];
}

export const countMotionKeys = (
  motions: readonly MotionKeyCollection[] | undefined
): number =>
  (motions ?? []).reduce(
    (count, motion) => count + motion.keys.length,
    0
  );
