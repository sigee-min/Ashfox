import assert from 'node:assert/strict';

import type {
  AuthoringProfile,
  AuthoringSupport
} from '../../../../src/authoring/contract';
import { evaluateSupportQuality } from '../../../../src/authoring/quality/support';
import {
  supportFixtures,
  type SupportFixture
} from './fixture';

const wheel = supportFixtures.wheel;
const wheelSlot = wheel.profile.slots.find(
  (slot) => slot.support.kind === 'wheel'
);
if (!wheelSlot || wheelSlot.support.kind !== 'wheel') {
  throw new Error('Wheel support fixture is missing its support slot.');
}
const wheelPartId = wheelSlot.support.wheelPartIds[0];
if (!wheelPartId) throw new Error('Wheel support fixture has no wheel part.');

const invalidReferences: AuthoringProfile = {
  ...wheel.profile,
  slots: wheel.profile.slots.map((slot) => slot.slotId === wheelSlot.slotId
    ? {
        ...slot,
        support: {
          ...wheelSlot.support,
          wheelPartIds: [wheelPartId, wheelPartId, 'wheel.missing']
        }
      }
    : slot)
};
const invalidDocumentBefore = JSON.stringify(wheel.document);
const invalidProfileBefore = JSON.stringify(invalidReferences);
const invalid = evaluateSupportQuality(wheel.document, invalidReferences);
assert.deepEqual(
  evaluateSupportQuality(wheel.document, invalidReferences),
  invalid,
  'invalid support diagnostics are deterministic'
);
assert.equal(JSON.stringify(wheel.document), invalidDocumentBefore);
assert.equal(JSON.stringify(invalidReferences), invalidProfileBefore);
assert.deepEqual(
  invalid.issues.map((entry) => entry.code),
  [
    'authoring.plan.support_part_unowned',
    'authoring.plan.support_part_duplicated',
    'authoring.plan.support_part_missing'
  ],
  'reference diagnostics retain source-stage insertion order'
);
assert.deepEqual(
  invalid.violations.map((entry) => entry.code),
  [
    'authoring.plan.support_part_unowned',
    'authoring.plan.support_part_duplicated'
  ],
  'missing materialization remains incomplete rather than a geometry violation'
);
const invalidStatus = invalid.statuses.find(
  (status) => status.slotId === wheelSlot.slotId
);
assert.equal(invalidStatus?.state, 'invalid');
assert.deepEqual(
  invalidStatus?.issueCodes,
  invalid.issues.map((entry) => entry.code)
);
assert.equal(invalid.ready, false);

const freeSupport = (
  support: AuthoringSupport
): AuthoringSupport => support.kind === 'none'
  ? support
  : { ...support, contact: 'free' };
const noGroundingProfile: AuthoringProfile = {
  ...wheel.profile,
  slots: wheel.profile.slots.map((slot) => ({
    ...slot,
    support: freeSupport(slot.support)
  }))
};
const missingGrounding = evaluateSupportQuality(
  wheel.document,
  noGroundingProfile
);
assert.deepEqual(
  missingGrounding.issues.map((entry) => entry.code),
  ['authoring.plan.support_grounding_missing']
);
assert.ok(missingGrounding.statuses.every((status) =>
  status.issueCodes.length === 0
));
assert.equal(missingGrounding.ready, false);

const contactFree: SupportFixture = {
  document: {
    ...wheel.document,
    intent: wheel.document.intent
      ? { ...wheel.document.intent, grounding: 'none' }
      : undefined
  },
  profile: wheel.profile
};
const intentMismatch = evaluateSupportQuality(
  contactFree.document,
  contactFree.profile
);
assert.deepEqual(
  intentMismatch.issues.map((entry) => entry.code),
  [
    'authoring.plan.support_grounding_intent_invalid',
    'authoring.plan.support_grounding_intent_invalid'
  ]
);
assert.ok(intentMismatch.statuses
  .filter((status) => status.supportKind === 'wheel')
  .every((status) =>
    status.state === 'invalid' &&
    status.issueCodes[0] ===
      'authoring.plan.support_grounding_intent_invalid'
  ));
