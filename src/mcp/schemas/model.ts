import { JsonSchema } from '../types';
import { RIG_TEMPLATE_KINDS } from '../../shared/toolConstants';
import { numberArray } from './common';

export const faceUvSchema: JsonSchema = {
  type: 'object',
  description:
    'Per-face UV map. Keys are cube faces (north/south/east/west/up/down). Values are [x1,y1,x2,y2] in texture pixels. UVs must fit within the current project textureResolution.',
  minProperties: 1,
  additionalProperties: false,
  properties: {
    north: numberArray(4, 4),
    south: numberArray(4, 4),
    east: numberArray(4, 4),
    west: numberArray(4, 4),
    up: numberArray(4, 4),
    down: numberArray(4, 4)
  }
};

export const modelPartSchema: JsonSchema = {
  type: 'object',
  required: ['id', 'size', 'offset'],
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      description:
        'Stable part id. Use "root" for the root bone. Must be unique. Prefer stable ids because renaming ids can break animation channels.'
    },
    size: numberArray(3, 3),
    offset: numberArray(3, 3),
    inflate: { type: 'number' },
    mirror: { type: 'boolean' },
    pivot: numberArray(3, 3),
    parent: {
      type: 'string',
      description:
        'Parent part id. Required for every non-root part. Must refer to an existing part id. Avoid flat lists; always form a tree (root -> body -> limbs/head).'
    }
  }
};

export const modelSpecSchema: JsonSchema = {
  type: 'object',
  required: ['rigTemplate', 'parts'],
  additionalProperties: false,
  properties: {
    rigTemplate: {
      type: 'string',
      enum: RIG_TEMPLATE_KINDS,
      description:
        'Rig template kind. Use "empty" for manual rigs. Templates may inject extra bones/parts; ids should remain stable across updates.'
    },
    parts: {
      type: 'array',
      description: 'Model parts to apply. Include a root part and parent every non-root part.',
      items: modelPartSchema
    }
  }
};
