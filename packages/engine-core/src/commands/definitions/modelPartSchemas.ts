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

const commonProperties = {
  partId: idSchema,
  parentPartId: {
    anyOf: [idSchema, { enum: [null] }]
  },
  materialId: idSchema,
  joint: jointSchema
} as const;

const commonRequired = [
  'partId',
  'materialId'
] as const;

const profileSchema = {
  enum: ['soft', 'balanced', 'hard']
} as const;

const axisSchema = {
  enum: ['x', 'y', 'z'],
  description:
    'Lattice axis. Positive x is east, positive y is up, and positive z is south.'
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
  description:
    'Author semantic parts in project-space lattice coordinates. For every child, ashfox derives a fixed joint by default, the nearest shared-face anchor and pivot, and a deterministic snap of at most two lattice cells. Shallow intersections remain intentional input and receive one canonical owner.',
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

export const modelPartsMirrorSchema = {
  type: 'object',
  description:
    'Copy one non-root canonical part subtree by exact lattice reflection, then normalize shallow joins to single-owner geometry. Every source subtree part requires one explicit unused target ID.',
  properties: {
    rootPartId: {
      ...idSchema,
      description:
        'Existing non-root part whose complete descendant subtree will be copied.'
    },
    axis: axisSchema,
    plane: {
      ...integerSchema,
      description:
        'Asset-space lattice coordinate of the reflection plane on the selected axis.'
    },
    partIdMap: {
      type: 'array',
      description:
        'Exact one-to-one source and target ID mapping covering the complete selected subtree.',
      items: {
        type: 'object',
        properties: {
          sourcePartId: {
            ...idSchema,
            description: 'Existing part in the selected source subtree.'
          },
          targetPartId: {
            ...idSchema,
            description: 'Unused stable ID for the reflected copy.'
          }
        },
        required: ['sourcePartId', 'targetPartId'],
        additionalProperties: false
      },
      minItems: 1,
      maxItems: PART_CONTRACT_LIMITS.maxPartsPerDocument
    }
  },
  required: ['rootPartId', 'axis', 'plane', 'partIdMap'],
  additionalProperties: false
} as const satisfies CommandInputSchema;

export const modelPartsTransformSchema = {
  type: 'object',
  description:
    'Translate one canonical part subtree in asset lattice space, then normalize shallow joins to single-owner geometry. Descendants are resolved internally, so the operation is not limited to 64 parts.',
  properties: {
    rootPartId: {
      ...idSchema,
      description:
        'Existing part to translate together with every canonical descendant.'
    },
    translation: {
      ...vec3Schema,
      description:
        'Integer [x,y,z] asset-space lattice translation applied atomically.'
    }
  },
  required: ['rootPartId', 'translation'],
  additionalProperties: false
} as const satisfies CommandInputSchema;
