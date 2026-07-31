import {
  compileAnimationMotion
} from '../../animation/motionAuthoring';
import {
  withoutImplicitRestPose
} from '../../animation/implicitRestPose';
import {
  MOTION_AUTHORING_LIMITS
} from '../../animation/motionContract';
import {
  PART_CONTRACT_LIMITS,
  PART_ID_PATTERN_SOURCE
} from '../../modeling/partContract';
import { defineCommand } from '../definition';

const MAX_ROTATION_DEGREES = 360;

const rotationDegreesSchema = {
  anyOf: [
    {
      type: 'number',
      minimum: -MAX_ROTATION_DEGREES,
      maximum: MAX_ROTATION_DEGREES
    },
    {
      type: 'array',
      items: {
        type: 'number',
        minimum: -MAX_ROTATION_DEGREES,
        maximum: MAX_ROTATION_DEGREES
      },
      minItems: 3,
      maxItems: 3
    }
  ]
} as const;

const inputSchema = {
  type: 'object',
  properties: {
    clipId: {
      type: 'string',
      minLength: 1,
      maxLength: PART_CONTRACT_LIMITS.maxIdLength,
      pattern: PART_ID_PATTERN_SOURCE,
      description:
        'Use exactly "idle" for the idle role. Non-idle IDs must not be idle or end in ".idle".'
    },
    role: {
      enum: ['idle', 'loop', 'once'],
      description:
        'Idle is the one canonical idle clip; loop and once require explicit motions.'
    },
    durationSeconds: {
      type: 'number',
      minimum: 0.05,
      maximum: 60
    },
    motions: {
      type: 'array',
      minItems: 0,
      maxItems:
        MOTION_AUTHORING_LIMITS.maxMotionsPerOperation,
      description:
        `Complete part motions with at most ${MOTION_AUTHORING_LIMITS.maxKeysPerOperation} total keys.`,
      items: {
        type: 'object',
        properties: {
          partId: {
            type: 'string',
            minLength: 1,
            maxLength: PART_CONTRACT_LIMITS.maxIdLength,
            pattern: PART_ID_PATTERN_SOURCE
          },
          keys: {
            type: 'array',
            minItems: 1,
            maxItems:
              MOTION_AUTHORING_LIMITS.maxKeysPerMotion,
            items: {
              type: 'object',
              properties: {
                phase: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1,
                  description:
                    'Normalized clip time. Loop endpoints are derived; a supplied closing key must equal phase 0.'
                },
                rotationDegrees: rotationDegreesSchema
              },
              required: ['phase', 'rotationDegrees'],
              additionalProperties: false
            }
          }
        },
        required: ['partId', 'keys'],
        additionalProperties: false
      }
    }
  },
  required: ['clipId', 'role'],
  additionalProperties: false
} as const;

export const upsertAnimationMotionCommand = defineCommand({
  name: 'animation.motion.upsert',
  label: 'Create complete part motion',
  purpose:
    'Create or replace one complete joint-aware numeric clip from normalized part poses; replacement removes omitted basic channels and requires advanced clips to be deleted and recreated in the same atomic batch.',
  inputSchema,
  apply: (document, payload) => {
    const compiled = compileAnimationMotion(document, payload);
    if (!compiled.ok) {
      return {
        ok: false,
        error: compiled.issue
      };
    }
    const {
      clip,
      current,
      removedTrackIds
    } = compiled;
    const animations = withoutImplicitRestPose(
      document.animations
    );
    const removedPlaceholderIds = Object.keys(
      document.animations
    ).filter(
      (id) =>
        animations[id] === undefined &&
        id !== clip.id
    );
    return {
      ok: true,
      value: {
        document: {
          ...document,
          animations: {
            ...animations,
            [clip.id]: clip
          }
        },
        summary:
          `${current ? 'Replace' : 'Create'} ` +
          `${payload.role} motion ${clip.id}`,
        effects: {
          createdEntityIds: current ? [] : [clip.id],
          changedEntityIds: current
            ? [clip.id, ...Object.keys(clip.channels)]
            : Object.keys(clip.channels),
          removedEntityIds: [
            ...removedTrackIds,
            ...removedPlaceholderIds
          ],
          invalidated: [
            'animations',
            'validation',
            'preview'
          ]
        }
      }
    };
  }
});
