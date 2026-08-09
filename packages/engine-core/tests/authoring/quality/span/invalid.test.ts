import assert from 'node:assert/strict';

import type { AuthoringProfile } from '../../../../src/authoring/contract';
import { evaluateSpanQuality } from '../../../../src/authoring/quality/span';
import {
  deepFreeze,
  spanFixture
} from './fixture';

const membranePartId = spanFixture.slot.span.membranes[0]?.partIds[0];
if (!membranePartId) throw new Error('Fixture has no membrane part.');
const invalidProfile: AuthoringProfile = {
  ...spanFixture.profile,
  slots: spanFixture.profile.slots.map((slot) =>
    slot.slotId === spanFixture.slot.slotId
      ? {
          ...slot,
          span: {
            ...spanFixture.slot.span,
            rootPartIds: [membranePartId]
          }
        }
      : slot
  )
};
deepFreeze(invalidProfile);
const snapshot = JSON.stringify(invalidProfile);
const first = evaluateSpanQuality(spanFixture.document, invalidProfile);
const second = evaluateSpanQuality(spanFixture.document, invalidProfile);
const status = first.statuses.find(
  (entry) => entry.slotId === spanFixture.slot.slotId
);

assert.deepEqual(second, first);
assert.equal(JSON.stringify(invalidProfile), snapshot);
assert.equal(first.ready, false);
assert.equal(status?.state, 'invalid');
assert.deepEqual(
  status?.issueCodes,
  [
    'authoring.plan.span_part_kind_invalid',
    'authoring.plan.span_root_parent_invalid',
    'authoring.plan.span_hierarchy_invalid',
    'authoring.plan.span_hierarchy_invalid',
    'authoring.plan.span_hierarchy_invalid'
  ],
  'status codes retain references, roots, spars, then membranes stage order'
);
const expectedDiagnostics = [
  [
    'authoring.plan.span_part_kind_invalid',
    'authoringProfile.slots.slot.surface.tail.center.span'
  ],
  [
    'authoring.plan.span_hierarchy_invalid',
    'authoringProfile.slots.slot.surface.tail.center.span.membranes.membrane.main'
  ],
  [
    'authoring.plan.span_root_parent_invalid',
    'authoringProfile.slots.slot.surface.tail.center.span.rootPartIds'
  ],
  [
    'authoring.plan.span_hierarchy_invalid',
    'authoringProfile.slots.slot.surface.tail.center.span.spars.spar.1'
  ],
  [
    'authoring.plan.span_hierarchy_invalid',
    'authoringProfile.slots.slot.surface.tail.center.span.spars.spar.2'
  ]
] as const;
assert.deepEqual(
  first.issues.map((entry) => [entry.code, entry.path]),
  expectedDiagnostics,
  'public diagnostics retain their canonical path/code order'
);
assert.deepEqual(
  first.violations.map((entry) => [entry.code, entry.path]),
  expectedDiagnostics
);
