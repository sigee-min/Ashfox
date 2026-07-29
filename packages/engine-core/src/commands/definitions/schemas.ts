import type { CommandInputSchema } from '../schema';

const finiteNumber: CommandInputSchema = {
  type: 'number'
};

export const vec2Schema: CommandInputSchema = {
  type: 'array',
  items: finiteNumber,
  minItems: 2,
  maxItems: 2
};

export const vec3Schema: CommandInputSchema = {
  type: 'array',
  items: finiteNumber,
  minItems: 3,
  maxItems: 3
};

export const uvRectSchema: CommandInputSchema = {
  type: 'array',
  items: finiteNumber,
  minItems: 4,
  maxItems: 4
};

export const entityIdsSchema: CommandInputSchema = {
  type: 'array',
  items: {
    type: 'string',
    minLength: 1
  },
  minItems: 1,
  maxItems: 128,
  uniqueItems: true
};

export const partialTransformSchema: CommandInputSchema = {
  type: 'object',
  properties: {
    position: vec3Schema,
    rotation: vec3Schema,
    scale: vec3Schema,
    pivot: vec3Schema
  },
  additionalProperties: false
};

export const nullableEntityIdSchema: CommandInputSchema = {
  anyOf: [
    {
      type: 'string',
      minLength: 1
    },
    {
      enum: [null]
    }
  ]
};

export const axisSchema: CommandInputSchema = {
  enum: ['x', 'y', 'z']
};

export const colorSchema: CommandInputSchema = {
  type: 'string',
  minLength: 4
};

export const animationScalarSchema: CommandInputSchema = {
  anyOf: [
    finiteNumber,
    {
      type: 'object',
      properties: {
        kind: {
          enum: ['molang']
        },
        source: {
          type: 'string',
          minLength: 1
        }
      },
      required: ['kind', 'source'],
      additionalProperties: false
    }
  ]
};

export const animationVec3Schema: CommandInputSchema = {
  type: 'array',
  items: animationScalarSchema,
  minItems: 3,
  maxItems: 3
};
