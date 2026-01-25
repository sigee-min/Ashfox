import { JsonSchema } from '../types';
import { RIG_TEMPLATE_KINDS } from '../../shared/toolConstants';
import { numberArray } from './common';

export const faceUvSchema: JsonSchema = {
  type: 'object',
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
    id: { type: 'string' },
    size: numberArray(3, 3),
    offset: numberArray(3, 3),
    inflate: { type: 'number' },
    mirror: { type: 'boolean' },
    pivot: numberArray(3, 3),
    parent: { type: 'string' }
  }
};

export const modelSpecSchema: JsonSchema = {
  type: 'object',
  required: ['rigTemplate', 'parts'],
  additionalProperties: false,
  properties: {
    rigTemplate: { type: 'string', enum: RIG_TEMPLATE_KINDS },
    parts: {
      type: 'array',
      items: modelPartSchema
    }
  }
};
