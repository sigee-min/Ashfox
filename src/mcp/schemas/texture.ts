import { JsonSchema } from '../types';
import { TEXTURE_PRESET_NAMES } from '../../shared/toolConstants';
import { cubeFaceSchema, numberArray } from './common';

export const texturePresetSchema: JsonSchema = {
  type: 'string',
  enum: TEXTURE_PRESET_NAMES
};

export const textureOpSchema: JsonSchema = {
  type: 'object',
  required: ['op'],
  additionalProperties: false,
  properties: {
    op: { type: 'string', enum: ['set_pixel', 'fill_rect', 'draw_rect', 'draw_line'] },
    x: { type: 'number' },
    y: { type: 'number' },
    width: { type: 'number' },
    height: { type: 'number' },
    x1: { type: 'number' },
    y1: { type: 'number' },
    x2: { type: 'number' },
    y2: { type: 'number' },
    color: { type: 'string' },
    lineWidth: { type: 'number' }
  }
};

export const uvPaintSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    scope: { type: 'string', enum: ['faces', 'rects', 'bounds'] },
    mapping: { type: 'string', enum: ['stretch', 'tile'] },
    padding: { type: 'number' },
    anchor: numberArray(2, 2),
    source: {
      type: 'object',
      additionalProperties: false,
      required: ['width', 'height'],
      properties: {
        width: { type: 'number' },
        height: { type: 'number' }
      }
    },
    target: {
      type: 'object',
      additionalProperties: false,
      properties: {
        cubeIds: { type: 'array', minItems: 1, items: { type: 'string' } },
        cubeNames: { type: 'array', minItems: 1, items: { type: 'string' } },
        faces: { type: 'array', minItems: 1, items: cubeFaceSchema }
      }
    }
  }
};
