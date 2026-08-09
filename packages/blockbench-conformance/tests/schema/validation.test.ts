import assert from 'node:assert/strict';

import {
  projectContractReader as currentProjectContractReader
} from '@ashfox/blockbench-contracts/types/project/contract';
import {
  projectContractReader as legacyProjectContractReader
} from '@ashfox/blockbench-contracts/types/projectContract';
import { runSchemaValidationContractTests } from '../../../blockbench-contracts/testSupport/schema/contract';

runSchemaValidationContractTests();
assert.equal(
  legacyProjectContractReader,
  currentProjectContractReader,
  'legacy projectContract subpath resolves to the canonical owner reader'
);
