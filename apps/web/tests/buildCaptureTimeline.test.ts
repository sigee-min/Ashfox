import assert from 'node:assert/strict';

import type {
  CommandReceipt,
  ProjectDocument
} from '@ashfox/engine-core';

import { createBuildCapturePlan } from '../src/features/capture/buildCaptureTimeline';
import { createWorkbenchProject } from './fixtures/workbenchProject';

const base = createWorkbenchProject();
const empty: ProjectDocument = {
  ...base,
  revision: 'local-0000',
  scene: {
    roots: [],
    nodes: {}
  },
  textures: {},
  animations: {}
};
const geometry: ProjectDocument = {
  ...empty,
  revision: 'local-0001',
  scene: base.scene
};
const rigOnly: ProjectDocument = {
  ...empty,
  revision: 'local-0000-rig',
  scene: {
    roots: base.scene.roots.filter(
      (id) => base.scene.nodes[id]?.kind === 'bone'
    ),
    nodes: Object.fromEntries(
      Object.entries(base.scene.nodes).filter(
        ([, node]) => node.kind === 'bone'
      )
    )
  }
};
const textured: ProjectDocument = {
  ...geometry,
  revision: 'local-0002',
  textures: base.textures
};
const animated: ProjectDocument = {
  ...textured,
  revision: 'local-0003',
  animations: base.animations
};

const receipt = (
  revision: string,
  beforeRevision: string,
  invalidated: CommandReceipt['effects']['invalidated']
): CommandReceipt => ({
  schemaVersion: 1,
  commandId: `command-${revision}`,
  projectId: base.id,
  actorId: 'agent',
  source: 'agent',
  summary: `Committed ${revision}`,
  beforeRevision,
  revision,
  completedAt: '2026-01-01T00:00:00.000Z',
  durationMs: 0,
  effects: {
    createdEntityIds: [],
    changedEntityIds: [],
    removedEntityIds: [],
    invalidated
  },
  findings: []
});

const rigReceipt = receipt(
  'local-0000-rig',
  'local-0000',
  ['scene', 'validation', 'preview']
);

const plan = createBuildCapturePlan(
  [empty, rigOnly, geometry, textured, animated],
  [
    {
      ...rigReceipt,
      summary: 'Created rig bones',
      effects: {
        ...rigReceipt.effects,
        createdEntityIds: Object.keys(rigOnly.scene.nodes)
      }
    },
    receipt(
      'local-0001',
      'local-0000-rig',
      ['scene', 'textures', 'uv', 'validation', 'preview']
    ),
    receipt('local-0002', 'local-0001', ['textures', 'uv']),
    receipt('local-0003', 'local-0002', ['animations'])
  ]
);

assert.deepEqual(
  plan.events.map((event) => event.category),
  ['start', 'geometry', 'texture', 'animation', 'complete']
);
assert.equal(plan.frames.length, 56);
assert.equal(plan.frames[0]?.event.document.revision, 'local-0000');
assert.equal(plan.frames.at(-1)?.event.document.revision, 'local-0003');
assert.ok(
  (plan.events.find((event) => event.category === 'geometry')
    ?.createdEntityIds.length ?? 0) > 0,
  'geometry events must preserve entity creation order for progressive reveal'
);
assert.throws(
  () => createBuildCapturePlan([empty], []),
  /at least one committed change/
);
