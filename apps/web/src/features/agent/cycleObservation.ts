export interface CycleObservation {
  durationSeconds: number;
  toleranceSeconds: number;
  maximumStepSeconds: number;
  accumulatedSeconds: number;
  previousTimeSeconds: number | null;
}

export interface CycleObservationResult {
  observation: CycleObservation;
  complete: boolean;
}

const MAX_BROWSER_TIMEOUT_MS = 2_147_000_000;

export const cyclePresentationTimeoutMs = (
  durationSeconds: number
): number =>
  Math.min(
    MAX_BROWSER_TIMEOUT_MS,
    Math.max(4_000, Math.ceil(durationSeconds * 4_000) + 4_000)
  );

export const createCycleObservation = (
  durationSeconds: number,
  fps: number
): CycleObservation => ({
  durationSeconds,
  toleranceSeconds: Math.min(
    durationSeconds,
    0.5 / Math.max(1, fps)
  ),
  maximumStepSeconds: Math.max(
    0.25,
    Math.min(1, durationSeconds / 4)
  ),
  accumulatedSeconds: 0,
  previousTimeSeconds: null
});

export const advanceCycleObservation = (
  observation: CycleObservation,
  timeSeconds: number
): CycleObservationResult => {
  if (
    !Number.isFinite(timeSeconds) ||
    timeSeconds < 0 ||
    timeSeconds > observation.durationSeconds
  ) {
    return { observation, complete: false };
  }
  const previous = observation.previousTimeSeconds;
  if (previous === null) {
    return {
      observation: {
        ...observation,
        previousTimeSeconds: timeSeconds
      },
      complete: false
    };
  }
  const delta = timeSeconds >= previous
    ? timeSeconds - previous
    : observation.durationSeconds - previous + timeSeconds;
  const accumulatedSeconds =
    delta <= observation.maximumStepSeconds
      ? observation.accumulatedSeconds + delta
      : observation.accumulatedSeconds;
  const next = {
    ...observation,
    accumulatedSeconds,
    previousTimeSeconds: timeSeconds
  };
  return {
    observation: next,
    complete:
      accumulatedSeconds + observation.toleranceSeconds >=
      observation.durationSeconds
  };
};
