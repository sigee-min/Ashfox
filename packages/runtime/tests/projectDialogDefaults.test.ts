import assert from 'node:assert/strict';

import { buildProjectDialogDefaults } from '../src/domain/project/projectDialogDefaults';

{
  const defaults = buildProjectDialogDefaults({
    formatId: 'geckolib_model',
    name: 'dragon'
  });
  assert.equal(defaults.format, 'geckolib_model');
  assert.equal(defaults.parent, undefined);
}

{
  const defaults = buildProjectDialogDefaults({
    formatId: null,
    name: 'anim'
  });
  assert.equal(defaults.format, undefined);
}
