import assert from 'node:assert/strict';

import {
  advanceCycleObservation,
  createCycleObservation,
  cyclePresentationTimeoutMs
} from '../../src/features/agent/cycleObservation';

let loop = createCycleObservation(1, 20);
for (const time of [0, 0.2, 0.4, 0.6, 0.8]) {
  const result = advanceCycleObservation(loop, time);
  loop = result.observation;
  assert.equal(result.complete, false);
}
const wrapped = advanceCycleObservation(loop, 0);
assert.equal(wrapped.complete, true);

let batchedRender = createCycleObservation(2, 20);
for (const time of [0, 0.4, 0.8, 1.2, 1.6]) {
  batchedRender = advanceCycleObservation(
    batchedRender,
    time
  ).observation;
}
assert.equal(
  advanceCycleObservation(batchedRender, 0).complete,
  true,
  'batched React frames must still prove a complete live cycle'
);

let once = createCycleObservation(1, 20);
for (const time of [0, 0.25, 0.5, 0.75]) {
  once = advanceCycleObservation(once, time).observation;
}
assert.equal(advanceCycleObservation(once, 1).complete, true);

let sixtyFpsOnce = createCycleObservation(1, 60);
sixtyFpsOnce = advanceCycleObservation(
  sixtyFpsOnce,
  0
).observation;
for (let frame = 1; frame <= 60; frame += 1) {
  const result = advanceCycleObservation(
    sixtyFpsOnce,
    frame / 60
  );
  sixtyFpsOnce = result.observation;
  if (frame < 60) assert.equal(result.complete, false);
  else assert.equal(result.complete, true);
}

assert.ok(
  cyclePresentationTimeoutMs(45) > 30_000,
  'valid long clips must not be forced through a 30 second ceiling'
);

const stalled = createCycleObservation(1, 20);
const discontinuity = advanceCycleObservation(
  {
    ...stalled,
    previousTimeSeconds: 0
  },
  0.8
);
assert.equal(discontinuity.complete, false);
assert.equal(discontinuity.observation.accumulatedSeconds, 0);
