import assert from 'node:assert/strict';

import {
  createProjectFromInput,
  executeCommandBatch,
  readCompiledParts,
  validateProjectDocument,
  type PartAuthoringSpec,
  type ProjectDocument
} from '@ashfox/engine-core';

import { inspectProject } from '../src/features/agent/inspect';

const roundTripParts = (): readonly PartAuthoringSpec[] => [{
  kind: 'mass',
  partId: 'core',
  materialId: 'stone',
  center: [0, 0, 0],
  radii: [4, 4, 4],
  profile: 'hard'
}, {
  kind: 'mass',
  partId: 'mass.detail',
  parentPartId: 'core',
  materialId: 'stone',
  center: [7, 0, 0],
  radii: [1, 1, 1],
  profile: 'balanced'
}, {
  kind: 'segment',
  partId: 'segment.detail',
  parentPartId: 'core',
  materialId: 'stone',
  points: [
    [0, 7, 0],
    [0, 10, 0]
  ],
  radii: [
    [1, 1, 1],
    [1, 1, 1]
  ],
  profile: 'balanced'
}, {
  kind: 'plate',
  partId: 'plate.detail',
  parentPartId: 'core',
  materialId: 'stone',
  plane: 'yz',
  origin: [-8, -2, -2],
  outline: [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4]
  ],
  thickness: 2
}, {
  kind: 'radial',
  partId: 'radial.detail',
  parentPartId: 'core',
  materialId: 'stone',
  axis: 'z',
  center: [0, 0, 7],
  outerRadius: 2,
  innerRadius: 0,
  depth: 2
}, {
  kind: 'feature',
  partId: 'feature.detail',
  parentPartId: 'core',
  materialId: 'stone',
  face: 'down',
  anchor: [0, -6, 0],
  size: [2, 2],
  relief: 1
}];

const compiledVisualSnapshot = (
  source: ProjectDocument
): unknown => {
  const compiled = readCompiledParts(source);
  assert.equal(compiled.ok, true);
  if (!compiled.ok) {
    throw new Error('Compiled round-trip fixture is invalid.');
  }
  return [...compiled.parts]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([partId, part]) => ({
      partId,
      bone: part.bone,
      cubes: part.cubes,
      occupancy: [...part.occupancy.cells].sort()
    }));
};

for (const density of [1, 2, 4] as const) {
  const emptyRoundTrip = createProjectFromInput(
    {
      id: `inspect-round-trip-${density}`,
      name: `Inspect round trip ${density}`,
      target: 'geckolib5',
      namespace: 'ashfox',
      modelPath: `inspect_round_trip_${density}`,
      createdAt: '2026-07-30T00:00:00.000Z'
    },
    `inspect-round-trip-revision-${density}`
  );
  const densityResult =
    density === 1
      ? { ok: true as const, document: emptyRoundTrip }
      : executeCommandBatch(
          emptyRoundTrip,
          {
            batchId: `inspect-density-${density}`,
            baseProjectId: emptyRoundTrip.id,
            baseRevision: emptyRoundTrip.revision,
            operations: [{
              name: 'textures.density.set',
              payload: { density }
            }]
          },
          { source: 'agent' }
        );
  assert.equal(densityResult.ok, true);
  if (!densityResult.ok) {
    throw new Error('Round-trip density could not be selected.');
  }
  const authored = executeCommandBatch(
    densityResult.document,
    {
      batchId: `inspect-author-${density}`,
      baseProjectId: densityResult.document.id,
      baseRevision: densityResult.document.revision,
      operations: [{
        name: 'model.parts.upsert',
        payload: {
          parts: roundTripParts(),
          materials: [{
            id: 'stone',
            baseColor: '#697386'
          }]
        }
      }]
    },
    { source: 'agent' }
  );
  assert.equal(authored.ok, true);
  if (!authored.ok) {
    throw new Error(
      `Round-trip fixture failed at density ${density}: ` +
      authored.error.message
    );
  }
  const requestedIds = roundTripParts().map((part) => part.partId);
  const inspected = inspectProject(
    authored.document,
    null,
    validateProjectDocument(authored.document),
    { kind: 'parts', ids: requestedIds }
  );
  assert.equal(inspected.ok, true);
  if (!inspected.ok) {
    throw new Error('Round-trip parts could not be inspected.');
  }
  const inspectedParts = (inspected.data as {
    parts: readonly { spec: PartAuthoringSpec }[];
  }).parts.map((part) => part.spec);
  assert.ok(
    inspectedParts.every(
      (part) => !Object.hasOwn(part, 'attachment')
    )
  );
  const inspectedMass = inspectedParts.find(
    (part) => part.partId === 'mass.detail'
  );
  const inspectedSegment = inspectedParts.find(
    (part) => part.partId === 'segment.detail'
  );
  const inspectedPlate = inspectedParts.find(
    (part) => part.partId === 'plate.detail'
  );
  const inspectedRadial = inspectedParts.find(
    (part) => part.partId === 'radial.detail'
  );
  const inspectedFeature = inspectedParts.find(
    (part) => part.partId === 'feature.detail'
  );
  assert.deepEqual(
    inspectedMass?.kind === 'mass'
      ? inspectedMass.center
      : null,
    [5, 0, 0],
    'inspect must expose the snapped project-space position'
  );
  assert.deepEqual(
    inspectedSegment?.kind === 'segment'
      ? inspectedSegment.points
      : null,
    [
      [0, 5, 0],
      [0, 8, 0]
    ]
  );
  assert.deepEqual(
    inspectedPlate?.kind === 'plate'
      ? inspectedPlate.origin
      : null,
    [-6, -2, -2]
  );
  assert.deepEqual(
    inspectedRadial?.kind === 'radial'
      ? inspectedRadial.center
      : null,
    [0, 0, 5]
  );
  assert.deepEqual(
    inspectedFeature?.kind === 'feature'
      ? inspectedFeature.anchor
      : null,
    [0, -4, 0]
  );
  const beforeRoundTrip = compiledVisualSnapshot(authored.document);
  const reapplied = executeCommandBatch(
    authored.document,
    {
      batchId: `inspect-reapply-${density}`,
      baseProjectId: authored.document.id,
      baseRevision: authored.document.revision,
      operations: [{
        name: 'model.parts.upsert',
        payload: {
          parts: inspectedParts
        }
      }]
    },
    { source: 'agent' }
  );
  assert.equal(reapplied.ok, true);
  if (!reapplied.ok) {
    throw new Error(
      `Inspected parts failed to reapply at density ${density}: ` +
      reapplied.error.message
    );
  }
  assert.deepEqual(
    compiledVisualSnapshot(reapplied.document),
    beforeRoundTrip,
    `inspect round-trip must preserve compiled output at density ${density}`
  );
}
