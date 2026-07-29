import type { SceneNode } from '@ashfox/engine-core';

import type { IconName } from '../Icon';

export const nodeIcon = (kind: SceneNode['kind']): IconName => {
  switch (kind) {
    case 'bone':
      return 'bone';
    case 'cube':
      return 'cube';
    case 'mesh':
      return 'mesh';
    case 'locator':
      return 'locator';
  }
};

export const nodeKindLabel = (kind: SceneNode['kind']): string => {
  switch (kind) {
    case 'bone':
      return 'Bone';
    case 'cube':
      return 'Cube';
    case 'mesh':
      return 'Mesh';
    case 'locator':
      return 'Locator';
  }
};

export const roundProjectValue = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;
