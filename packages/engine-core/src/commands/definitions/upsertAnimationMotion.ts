import {
  compileAnimationMotion
} from '../../animation/motionAuthoring';
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
        'Required for a new clip. Omit on an existing clip to preserve its name and loop mode; an explicit value changes the whole clip role.'
    },
    durationFrames: {
      type: 'number',
      integer: true,
      minimum: 1,
      maximum: MOTION_AUTHORING_LIMITS.maxDurationFrames,
      description:
        'Required for a new clip. Omit on an existing clip to preserve duration, FPS, channel times, and trigger times. An explicit value retimes the whole clip at 20 FPS and rejects when a preserved key or trigger would land between frames.'
    },
    static: {
      type: 'boolean',
      description:
        'Explicitly create a motionless idle. Valid only for the idle role.'
    },
    poses: {
      type: 'array',
      minItems: 1,
      maxItems: MOTION_AUTHORING_LIMITS.maxPosesPerOperation,
      description:
        'Ordered whole-clip poses. Every referenced part must appear in the first pose; later omissions hold its previous submitted rotation. The engine distributes poses over canonical frames and closes loops.',
      items: {
        type: 'object',
        properties: {
          rotations: {
            type: 'object',
            properties: {},
            minProperties: 1,
            maxProperties:
              MOTION_AUTHORING_LIMITS.maxPartTracksPerOperation,
            additionalProperties: rotationDegreesSchema,
            description:
              'Map compiled part IDs to hinge scalar angles or root/ball XYZ angles.'
          }
        },
        required: ['rotations'],
        additionalProperties: false
      }
    },
    spins: {
      type: 'array',
      minItems: 1,
      maxItems: MOTION_AUTHORING_LIMITS.maxSpinsPerOperation,
      description:
        'Continuous hinge rotations baked at canonical 20 fps.',
      items: {
        type: 'object',
        properties: {
          partId: {
            type: 'string',
            minLength: 1,
            maxLength: PART_CONTRACT_LIMITS.maxIdLength,
            pattern: PART_ID_PATTERN_SOURCE
          },
          turns: {
            type: 'number',
            minimum: 0.01,
            maximum: 64
          },
          direction: {
            enum: ['positive', 'negative'],
            description:
              'Direction around the hinge local positive axis; positive is the default.'
          }
        },
        required: ['partId', 'turns'],
        additionalProperties: false
      }
    },
    removePartIds: {
      type: 'array',
      minItems: 1,
      maxItems:
        MOTION_AUTHORING_LIMITS.maxPartTracksPerOperation,
      uniqueItems: true,
      description:
        'Explicitly delete only these part rotation tracks while preserving every omitted track.',
      items: {
        type: 'string',
        minLength: 1,
        maxLength: PART_CONTRACT_LIMITS.maxIdLength,
        pattern: PART_ID_PATTERN_SOURCE
      }
    }
  },
  required: ['clipId'],
  additionalProperties: false
} as const;

export const upsertAnimationMotionCommand = defineCommand({
  name: 'animation.motion.upsert',
  label: 'Create or patch canonical motion',
  purpose:
    'Create or patch one joint-aware clip from ordered poses and continuous hinge spins; patch timing and role are preserved unless explicitly supplied, omitted part tracks are preserved, and only removePartIds deletes tracks.',
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
    return {
      ok: true,
      value: {
        document: {
          ...document,
          animations: {
            ...document.animations,
            [clip.id]: clip
          }
        },
        summary:
          `${current ? 'Patch' : 'Create'} motion ${clip.id}`,
        effects: {
          createdEntityIds: current ? [] : [clip.id],
          changedEntityIds: current
            ? [clip.id, ...Object.keys(clip.channels)]
            : Object.keys(clip.channels),
          removedEntityIds: removedTrackIds,
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
