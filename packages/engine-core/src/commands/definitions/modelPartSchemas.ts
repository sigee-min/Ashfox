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
  'partId'
] as const;

const profileSchema = {
  enum: ['soft', 'balanced', 'hard']
} as const;

const massProfileSchema = {
  enum: ['block', 'soft', 'balanced', 'hard'],
  description:
    'Block is the iconic default and emits one primary cuboid before hidden seam ownership. Soft and balanced select a short stepped silhouette template; hard remains blocklike. Rounded profiles are reserved for silhouette-critical forms.'
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
      description:
        'Mass. New: materialId, center, and radii. Existing same-kind patch: only changed fields.',
      properties: {
        ...commonProperties,
        kind: { enum: ['mass'] },
        center: vec3Schema,
        radii: extentVec3Schema,
        profile: massProfileSchema
      },
      required: [
        ...commonRequired,
        'kind'
      ],
      additionalProperties: false
    },
    {
      type: 'object',
      description:
        'Segment. New: materialId, points, and radii. Existing same-kind patch: only changed fields.',
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
          anyOf: [
            extentVec3Schema,
            {
              type: 'array',
              items: extentVec3Schema,
              minItems: 2,
              maxItems: PART_CONTRACT_LIMITS.maxSegmentPoints
            }
          ],
          description:
            'One radius triple broadcasts to every point; an array assigns one triple per point.'
        },
        profile: profileSchema
      },
      required: [
        ...commonRequired,
        'kind'
      ],
      additionalProperties: false
    },
    {
      type: 'object',
      description:
        'Plate. New: materialId, plane, origin, thickness, and exactly one of size or outline. Existing same-kind patch: only changed fields.',
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
        size: {
          ...extentVec2Schema,
          description:
            'Rectangle width and height. Use this instead of outline.'
        },
        thickness: extentSchema
      },
      required: [
        ...commonRequired,
        'kind'
      ],
      additionalProperties: false
    },
    {
      type: 'object',
      description:
        'Radial. New: materialId, axis, center, outerRadius, and depth. Existing same-kind patch: only changed fields.',
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
        'kind'
      ],
      additionalProperties: false
    },
    {
      type: 'object',
      description:
        'Feature. A bounded zero-depth semantic marking on the outer face of a mass or segment. New: parentPartId, materialId, motif, face, anchor, and size; focal motifs also accept glyph. Existing same-kind patch: only changed fields. It paints the generated surface and never creates protruding detail geometry.',
      properties: {
        ...commonProperties,
        joint: {
          type: 'object',
          properties: {
            kind: { enum: ['fixed'] }
          },
          required: ['kind'],
          additionalProperties: false
        },
        kind: { enum: ['feature'] },
        motif: {
          enum: ['eye', 'nose', 'mouth', 'patch'],
          description:
            'Eye, nose, and mouth derive compact deterministic focal glyphs. Patch fills the region with a deterministic, system-shaded material cluster.'
        },
        glyph: {
          enum: [
            'dot',
            'square',
            'slit',
            'snout',
            'neutral',
            'fang',
            'beak'
          ],
          description:
            'Motif-specific pixel language: eye square/slit; nose dot/snout; mouth neutral/fang/beak. Patch does not accept glyph.'
        },
        face: {
          enum: ['north', 'south', 'east', 'west', 'up', 'down']
        },
        anchor: vec3Schema,
        size: {
          type: 'array',
          items: extentSchema,
          minItems: 2,
          maxItems: 2,
          description:
            'Face-local pixel width and height. Focal glyphs stay compact; patch may cover any valid parent-bound rectangle.'
        }
      },
      required: [
        ...commonRequired,
        'kind'
      ],
      additionalProperties: false
    }
  ]
} as const satisfies CommandInputSchema;

export const modelPartsUpsertSchema = {
  type: 'object',
  description:
    'Create semantic parts or patch existing same-kind parts in project-space lattice coordinates. Every omitted field on an existing part is preserved. New fixed parts may omit parentPartId only when exactly one geometric parent is unambiguous; articulated joints and surface features require an explicit parent. ashfox derives model-scale contact, anchors, pivots, seam ownership, and the nearest valid surface-template placement.',
  properties: {
    parts: {
      type: 'array',
      items: modelPartSpecSchema,
      minItems: 1,
      maxItems: PART_CONTRACT_LIMITS.maxPartsPerBatch
    },
    materials: {
      type: 'array',
      description:
        'Optional base-color definitions for material IDs not already present in the project.',
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
  required: ['parts'],
  additionalProperties: false
} as const satisfies CommandInputSchema;

export const modelPartsMaterialSchema = {
  type: 'object',
  description:
    'Assign an existing material, derive one from a base color, or provide both. Recoloring only part of a shared material forks it automatically.',
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
  required: ['partIds'],
  atLeastOne: ['materialId', 'baseColor'],
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
    'Copy one non-root canonical part subtree by exact lattice reflection, then rederive parent contact and deterministic single-owner semantic cuboids. ashfox derives every target ID deterministically.',
  properties: {
    rootPartId: {
      ...idSchema,
      description:
        'Existing non-root part whose complete descendant subtree will be copied.'
    },
    axis: axisSchema,
    plane: {
      type: 'number',
      minimum: -PART_CONTRACT_LIMITS.maxAbsoluteCoordinate,
      maximum: PART_CONTRACT_LIMITS.maxAbsoluteCoordinate,
      multipleOf: 0.5,
      description:
        'Asset-space reflection plane on the whole- or half-lattice grid.'
    },
    targetRootPartId: {
      ...idSchema,
      description:
        'Optional stable ID for the mirrored subtree root. When omitted, ashfox derives it from the source root, axis, and plane.'
    }
  },
  required: ['rootPartId', 'axis', 'plane'],
  additionalProperties: false
} as const satisfies CommandInputSchema;

export const modelPartsTransformSchema = {
  type: 'object',
  description:
    'Translate one canonical part subtree in asset lattice space, then rederive parent contact, surface templates, and single-owner semantic cuboids. Descendants are resolved internally, so the operation is not limited to 64 parts.',
  properties: {
    rootPartId: {
      ...idSchema,
      description:
        'Existing part to translate together with every canonical descendant.'
    },
    by: {
      ...vec3Schema,
      description:
        'Integer [x,y,z] asset-space lattice translation applied atomically.'
    }
  },
  required: ['rootPartId', 'by'],
  additionalProperties: false
} as const satisfies CommandInputSchema;
