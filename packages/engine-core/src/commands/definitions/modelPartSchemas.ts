import type { CommandInputSchema } from '../schema';
import {
  PART_CONTRACT_LIMITS,
  PART_ID_PATTERN_SOURCE
} from '../../modeling/partContract';
import { colorSchema } from './schemas';

const idSchema = {
  type: 'string',
  minLength: 1,
  maxLength: PART_CONTRACT_LIMITS.maxIdLength,
  pattern: PART_ID_PATTERN_SOURCE
} as const;

const integerSchema = {
  type: 'number',
  integer: true,
  minimum: -PART_CONTRACT_LIMITS.maxAbsoluteCoordinate,
  maximum: PART_CONTRACT_LIMITS.maxAbsoluteCoordinate
} as const;

const extentSchema = {
  type: 'number',
  integer: true,
  minimum: 1,
  maximum: PART_CONTRACT_LIMITS.maxExtent
} as const;

const vec2Schema = {
  type: 'array',
  items: integerSchema,
  minItems: 2,
  maxItems: 2
} as const;

const vec3Schema = {
  type: 'array',
  items: integerSchema,
  minItems: 3,
  maxItems: 3
} as const;

const extentVec2Schema = {
  type: 'array',
  items: extentSchema,
  minItems: 2,
  maxItems: 2
} as const;

const extentVec3Schema = {
  type: 'array',
  items: extentSchema,
  minItems: 3,
  maxItems: 3
} as const;

const jointSchema = {
  anyOf: [
    {
      type: 'object',
      properties: {
        kind: { enum: ['fixed'] }
      },
      required: ['kind'],
      additionalProperties: false
    },
    {
      type: 'object',
      properties: {
        kind: { enum: ['hinge'] },
        axis: { enum: ['x', 'y', 'z'] }
      },
      required: ['kind', 'axis'],
      additionalProperties: false
    },
    {
      type: 'object',
      properties: {
        kind: { enum: ['ball'] }
      },
      required: ['kind'],
      additionalProperties: false
    }
  ]
} as const;

const attachmentSchema = {
  anyOf: [
    { enum: [null] },
    {
      type: 'object',
      properties: {
        parentAnchor: vec3Schema,
        partAnchor: vec3Schema
      },
      required: ['parentAnchor', 'partAnchor'],
      additionalProperties: false
    }
  ]
} as const;

const commonProperties = {
  partId: idSchema,
  parentPartId: {
    anyOf: [idSchema, { enum: [null] }]
  },
  materialId: idSchema,
  joint: jointSchema,
  attachment: attachmentSchema
} as const;

const commonRequired = [
  'partId',
  'materialId'
] as const;

const profileSchema = {
  enum: ['soft', 'balanced', 'hard']
} as const;

export const modelPartSpecSchema = {
  anyOf: [
    {
      type: 'object',
      properties: {
        ...commonProperties,
        kind: { enum: ['mass'] },
        center: vec3Schema,
        radii: extentVec3Schema,
        profile: profileSchema
      },
      required: [
        ...commonRequired,
        'kind',
        'center',
        'radii'
      ],
      additionalProperties: false
    },
    {
      type: 'object',
      properties: {
        ...commonProperties,
        kind: { enum: ['segment'] },
        points: {
          type: 'array',
          items: vec3Schema,
          minItems: 2,
          maxItems: PART_CONTRACT_LIMITS.maxSegmentPoints
        },
        radii: {
          type: 'array',
          items: extentVec3Schema,
          minItems: 2,
          maxItems: PART_CONTRACT_LIMITS.maxSegmentPoints
        },
        profile: profileSchema
      },
      required: [
        ...commonRequired,
        'kind',
        'points',
        'radii'
      ],
      additionalProperties: false
    },
    {
      type: 'object',
      properties: {
        ...commonProperties,
        kind: { enum: ['plate'] },
        plane: { enum: ['xy', 'xz', 'yz'] },
        origin: vec3Schema,
        outline: {
          type: 'array',
          items: vec2Schema,
          minItems: 3,
          maxItems: 4
        },
        thickness: extentSchema
      },
      required: [
        ...commonRequired,
        'kind',
        'plane',
        'origin',
        'outline',
        'thickness'
      ],
      additionalProperties: false
    },
    {
      type: 'object',
      properties: {
        ...commonProperties,
        kind: { enum: ['radial'] },
        axis: { enum: ['x', 'y', 'z'] },
        center: vec3Schema,
        outerRadius: extentSchema,
        innerRadius: {
          type: 'number',
          integer: true,
          minimum: 0,
          maximum: PART_CONTRACT_LIMITS.maxExtent - 1
        },
        depth: extentSchema
      },
      required: [
        ...commonRequired,
        'kind',
        'axis',
        'center',
        'outerRadius',
        'depth'
      ],
      additionalProperties: false
    },
    {
      type: 'object',
      properties: {
        ...commonProperties,
        kind: { enum: ['feature'] },
        face: {
          enum: ['north', 'south', 'east', 'west', 'up', 'down']
        },
        anchor: vec3Schema,
        size: extentVec2Schema,
        relief: {
          type: 'number',
          integer: true,
          minimum: 1,
          maximum: PART_CONTRACT_LIMITS.maxRelief
        }
      },
      required: [
        ...commonRequired,
        'kind',
        'face',
        'anchor',
        'size'
      ],
      additionalProperties: false
    }
  ]
} as const satisfies CommandInputSchema;

export const modelPartsUpsertSchema = {
  type: 'object',
  properties: {
    parts: {
      type: 'array',
      items: modelPartSpecSchema,
      minItems: 1,
      maxItems: PART_CONTRACT_LIMITS.maxPartsPerBatch
    },
    materials: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: idSchema,
          baseColor: colorSchema
        },
        required: ['id', 'baseColor'],
        additionalProperties: false
      },
      minItems: 0,
      maxItems: PART_CONTRACT_LIMITS.maxPartsPerBatch
    }
  },
  required: ['parts', 'materials'],
  additionalProperties: false
} as const satisfies CommandInputSchema;

export const modelPartsMaterialSchema = {
  type: 'object',
  properties: {
    partIds: {
      type: 'array',
      items: idSchema,
      minItems: 1,
      maxItems: PART_CONTRACT_LIMITS.maxPartsPerBatch,
      uniqueItems: true
    },
    materialId: idSchema,
    baseColor: colorSchema
  },
  required: ['partIds', 'materialId', 'baseColor'],
  additionalProperties: false
} as const satisfies CommandInputSchema;

export const modelPartsDeleteSchema = {
  type: 'object',
  properties: {
    partIds: {
      type: 'array',
      items: idSchema,
      minItems: 1,
      maxItems: PART_CONTRACT_LIMITS.maxPartsPerBatch,
      uniqueItems: true
    }
  },
  required: ['partIds'],
  additionalProperties: false
} as const satisfies CommandInputSchema;
