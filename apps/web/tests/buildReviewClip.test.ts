import assert from 'node:assert/strict';

import {
  createWorkbenchProject
} from '../src/features/workbench/sampleProject';
import {
  resolveBuildReviewClip
} from '../src/features/capture/buildReviewClip';

const document = structuredClone(createWorkbenchProject());
const source = Object.values(document.animations)[0];
if (!source) throw new Error('Animation fixture is unavailable.');

document.animations = {
  'clip-secondary': {
    ...structuredClone(source),
    id: 'clip-secondary',
    name: 'Wave'
  },
  'clip-idle': {
    ...structuredClone(source),
    id: 'clip-idle',
    name: 'animation.demo.idle'
  }
};
assert.equal(
  resolveBuildReviewClip(document)?.id,
  'clip-idle',
  'build review prefers the canonical Idle clip deterministically'
);

document.animations['clip-idle'] = {
  ...document.animations['clip-idle'],
  startDelay: {
    kind: 'molang',
    source: 'query.life_time'
  }
};
assert.equal(
  resolveBuildReviewClip(document),
  null,
  'an unfaithful preferred clip must fail closed instead of partially rendering or substituting another clip'
);

document.animations = {
  'clip-empty': {
    ...structuredClone(source),
    id: 'clip-empty',
    name: 'Idle',
    channels: {}
  }
};
assert.equal(
  resolveBuildReviewClip(document),
  null,
  'an empty review clip must leave the build capture in its rest pose'
);
