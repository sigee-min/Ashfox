import assert from 'node:assert/strict';

import {
  createOperationLease
} from '../src/application/operationLease';

const lease = createOperationLease();
const first = lease.tryAcquire('agent.run');
assert.ok(first);
assert.equal(lease.currentOwner(), 'agent.run');
assert.equal(lease.isActive(first), true);
assert.equal(lease.tryAcquire('file.open'), null);

first.release();
first.release();
assert.equal(lease.currentOwner(), null);
assert.equal(lease.isActive(first), false);

const second = lease.tryAcquire('file.open');
assert.ok(second);
assert.notEqual(second, first);
assert.equal(lease.currentOwner(), 'file.open');
first.release();
assert.equal(lease.currentOwner(), 'file.open');
assert.equal(lease.isActive(second), true);
second.release();
assert.equal(lease.currentOwner(), null);
