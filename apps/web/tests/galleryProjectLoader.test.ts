import assert from 'node:assert/strict';

import {
  resolveGalleryProjectUrl
} from '../src/features/workbench/controller/galleryProjectLoader';

const origin = 'https://ashfox.io';

assert.equal(
  resolveGalleryProjectUrl(
    '?project=%2Fdemos%2Faether-spear-rocket%2Fproject.ashfox',
    origin
  ),
  'https://ashfox.io/demos/aether-spear-rocket/project.ashfox'
);
assert.equal(
  resolveGalleryProjectUrl(
    '?project=https%3A%2F%2Fevil.example%2Fdemos%2Fdemo%2Fproject.ashfox',
    origin
  ),
  null
);
assert.equal(
  resolveGalleryProjectUrl('?project=/demos/demo/other.ashfox', origin),
  null
);
assert.equal(
  resolveGalleryProjectUrl(
    '?project=/demos/demo/project.ashfox%3Fdownload%3D1',
    origin
  ),
  null
);
assert.equal(resolveGalleryProjectUrl('', origin), null);
