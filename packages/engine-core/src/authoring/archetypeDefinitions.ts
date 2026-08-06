import { semanticSlot as slot } from './authoringDefinitionBuilders';
import {
  AUTHORING_PROFILE_SCHEMA_VERSION,
  type ArchetypeDefinition
} from './authoringTypes';

export const archetypeDefinitions: readonly ArchetypeDefinition[] = [
  {
    id: 'archetype.mini-biped',
    version: AUTHORING_PROFILE_SCHEMA_VERSION,
    label: 'Compact upright figure',
    summary:
      'A small upright figure with one head, one torso, paired arms, paired legs, and a surface-authored face.',
    useWhen:
      'Use when an upright two-armed body plan carries the subject before role, material, or motion cues are applied.',
    instruction:
      'Establish the oversized head, compact torso, paired limbs, and forward read before attaching specialist contributions.',
    facets: ['character', 'humanoid', 'upright'],
    capabilities: [
      'animation.anchor',
      'locomotion.paired',
      'surface.host'
    ],
    evidenceCriteria: [{
      id: 'criterion.body-plan',
      basis: 'either',
      required: true,
      instruction:
        'Ground the upright two-armed body plan in a current request or reference observation.'
    }],
    semanticSlots: [
      slot('body.torso', 'Torso', ['mass'], 'Create one compact primary body mass.'),
      slot('body.head', 'Head', ['mass'], 'Create one dominant head mass that owns the face.', {
        parentSlotIds: ['body.torso'],
        spatialRelations: ['above']
      }),
      slot('body.arm-left', 'Left arm', ['mass', 'segment'], 'Create one simple left arm chain.', {
        parentSlotIds: ['body.torso'],
        spatialRelations: ['left'],
        maxParts: 2
      }),
      slot('body.arm-right', 'Right arm', ['mass', 'segment'], 'Create one simple right arm chain.', {
        parentSlotIds: ['body.torso'],
        spatialRelations: ['right'],
        maxParts: 2
      }),
      slot('body.leg-left', 'Left leg', ['mass', 'segment'], 'Create one supporting left leg.', {
        parentSlotIds: ['body.torso'],
        spatialRelations: ['left', 'below'],
        maxParts: 2
      }),
      slot('body.leg-right', 'Right leg', ['mass', 'segment'], 'Create one supporting right leg.', {
        parentSlotIds: ['body.torso'],
        spatialRelations: ['right', 'below'],
        maxParts: 2
      }),
      slot('body.face', 'Face', ['feature'], 'Place compact facial glyphs on the owning head surface.', {
        parentSlotIds: ['body.head'],
        facing: 'forward',
        maxParts: 4
      })
    ],
    attachmentPorts: [
      {
        id: 'port.hand-or-module',
        type: 'role-prop',
        hostSlotIds: ['body.arm-left', 'body.arm-right', 'body.torso'],
        capacity: 2,
        acceptsFacets: ['role-prop']
      },
      {
        id: 'port.surface-cue',
        type: 'surface-cue',
        hostSlotIds: ['body.head', 'body.torso'],
        capacity: 2,
        acceptsFacets: ['surface-cue']
      },
      {
        id: 'port.silhouette-cue',
        type: 'silhouette-cue',
        hostSlotIds: ['body.head', 'body.torso'],
        capacity: 1,
        acceptsFacets: ['silhouette-cue']
      }
    ],
    compatibility: [],
    reviewChecks: [
      {
        id: 'compact-upright.thumbnail-read',
        facets: ['silhouette'],
        cameras: ['native', 'perspective'],
        issue: 'silhouette',
        instruction:
          'Confirm the head, torso, and paired limbs read without relying on attached detail.'
      },
      {
        id: 'compact-upright.face-read',
        facets: ['face'],
        cameras: ['front', 'perspective'],
        issue: 'focal_detail',
        instruction:
          'Confirm the face is centered, unobstructed, and authored on the head surface.'
      }
    ]
  },
  {
    id: 'archetype.pillar-stalker',
    version: AUTHORING_PROFILE_SCHEMA_VERSION,
    label: 'Pillar stalker',
    summary:
      'An arm-free upright body column with a dominant head, four compact feet, and a graphic face.',
    useWhen:
      'Use when a narrow stalking silhouette and four-foot footprint define the subject.',
    instruction:
      'Keep the body column uninterrupted and make all four grounded feet readable before adding surface cues.',
    facets: ['creature', 'upright', 'arm-free'],
    capabilities: [
      'animation.anchor',
      'locomotion.stalking',
      'surface.host'
    ],
    evidenceCriteria: [{
      id: 'criterion.body-plan',
      basis: 'either',
      required: true,
      instruction:
        'Ground the arm-free column and four-point footprint in a current request or reference observation.'
    }],
    semanticSlots: [
      slot('body.column', 'Body column', ['mass'], 'Create one tall primary body column.'),
      slot('body.head', 'Head', ['mass'], 'Create one dominant head mass.', {
        parentSlotIds: ['body.column'],
        spatialRelations: ['above']
      }),
      slot('body.foot-front-left', 'Front-left foot', ['mass', 'segment'], 'Create one short grounded front-left foot.', {
        parentSlotIds: ['body.column'],
        spatialRelations: ['front', 'left', 'below']
      }),
      slot('body.foot-front-right', 'Front-right foot', ['mass', 'segment'], 'Create one short grounded front-right foot.', {
        parentSlotIds: ['body.column'],
        spatialRelations: ['front', 'right', 'below']
      }),
      slot('body.foot-rear-left', 'Rear-left foot', ['mass', 'segment'], 'Create one short grounded rear-left foot.', {
        parentSlotIds: ['body.column'],
        spatialRelations: ['rear', 'left', 'below']
      }),
      slot('body.foot-rear-right', 'Rear-right foot', ['mass', 'segment'], 'Create one short grounded rear-right foot.', {
        parentSlotIds: ['body.column'],
        spatialRelations: ['rear', 'right', 'below']
      }),
      slot('body.face', 'Face', ['feature'], 'Place a high-contrast face glyph on the head.', {
        parentSlotIds: ['body.head'],
        facing: 'forward',
        maxParts: 4
      })
    ],
    attachmentPorts: [
      {
        id: 'port.surface-cue',
        type: 'surface-cue',
        hostSlotIds: ['body.head', 'body.column'],
        capacity: 2,
        acceptsFacets: ['surface-cue']
      },
      {
        id: 'port.silhouette-cue',
        type: 'silhouette-cue',
        hostSlotIds: ['body.head', 'body.column'],
        capacity: 1,
        acceptsFacets: ['silhouette-cue']
      }
    ],
    compatibility: [{
      op: 'forbids',
      path: 'selection.facets',
      value: 'role-prop'
    }],
    reviewChecks: [{
      id: 'pillar-stalker.body-read',
      facets: ['silhouette'],
      cameras: ['native', 'front', 'side'],
      issue: 'silhouette',
      instruction:
        'Confirm an uninterrupted arm-free column and four-foot footprint remain legible.'
    }]
  },
  {
    id: 'archetype.quadruped',
    version: AUTHORING_PROFILE_SCHEMA_VERSION,
    label: 'Compact quadruped',
    summary:
      'A horizontal trunk, forward head, four grounded limbs, and optional tail-bearing silhouette.',
    useWhen:
      'Use when four grounded limbs and a horizontal head-to-body relationship define the subject.',
    instruction:
      'Build the trunk and forward head first, then attach four readable limb roots before specialist cues.',
    facets: ['creature', 'quadruped', 'horizontal'],
    capabilities: [
      'animation.anchor',
      'locomotion.paired',
      'surface.host'
    ],
    evidenceCriteria: [{
      id: 'criterion.body-plan',
      basis: 'either',
      required: true,
      instruction:
        'Ground the horizontal trunk and four-limb body plan in a current request or reference observation.'
    }],
    semanticSlots: [
      slot('body.trunk', 'Trunk', ['mass'], 'Create one dominant horizontal trunk.'),
      slot('body.head', 'Head', ['mass'], 'Create one head mass forward of the trunk.', {
        parentSlotIds: ['body.trunk'],
        spatialRelations: ['front']
      }),
      slot('body.leg-front-left', 'Front-left leg', ['mass', 'segment'], 'Create the front-left grounded limb.', {
        parentSlotIds: ['body.trunk'],
        spatialRelations: ['front', 'left', 'below'],
        maxParts: 2
      }),
      slot('body.leg-front-right', 'Front-right leg', ['mass', 'segment'], 'Create the front-right grounded limb.', {
        parentSlotIds: ['body.trunk'],
        spatialRelations: ['front', 'right', 'below'],
        maxParts: 2
      }),
      slot('body.leg-rear-left', 'Rear-left leg', ['mass', 'segment'], 'Create the rear-left grounded limb.', {
        parentSlotIds: ['body.trunk'],
        spatialRelations: ['rear', 'left', 'below'],
        maxParts: 2
      }),
      slot('body.leg-rear-right', 'Rear-right leg', ['mass', 'segment'], 'Create the rear-right grounded limb.', {
        parentSlotIds: ['body.trunk'],
        spatialRelations: ['rear', 'right', 'below'],
        maxParts: 2
      }),
      slot('body.face', 'Face', ['feature'], 'Place compact facial marks on the head surface.', {
        parentSlotIds: ['body.head'],
        facing: 'forward',
        maxParts: 4
      }),
      slot('body.tail', 'Tail', ['mass', 'segment'], 'Add a tail only when it changes the outer contour.', {
        required: false,
        minParts: 0,
        maxParts: 3,
        parentSlotIds: ['body.trunk'],
        spatialRelations: ['rear']
      })
    ],
    attachmentPorts: [
      {
        id: 'port.surface-cue',
        type: 'surface-cue',
        hostSlotIds: ['body.head', 'body.trunk'],
        capacity: 2,
        acceptsFacets: ['surface-cue']
      },
      {
        id: 'port.silhouette-cue',
        type: 'silhouette-cue',
        hostSlotIds: ['body.head', 'body.trunk'],
        capacity: 1,
        acceptsFacets: ['silhouette-cue']
      }
    ],
    compatibility: [{
      op: 'forbids',
      path: 'selection.facets',
      value: 'role-prop'
    }],
    reviewChecks: [{
      id: 'compact-quadruped.stance-read',
      facets: ['silhouette', 'grounding'],
      cameras: ['native', 'side', 'top'],
      issue: 'proportion',
      instruction:
        'Confirm the horizontal trunk, forward head, and four grounded limbs read as one stance.'
    }]
  },
  {
    id: 'archetype.compact-construct',
    version: AUTHORING_PROFILE_SCHEMA_VERSION,
    label: 'Compact functional construct',
    summary:
      'A central core, readable support, sensor, and one function-bearing module.',
    useWhen:
      'Use when a compact non-anatomical device is organized around one core and one primary function.',
    instruction:
      'Resolve the core, support, sensor direction, and function module before surface decoration.',
    facets: ['construct', 'compact', 'functional'],
    capabilities: [
      'animation.anchor',
      'rotary.drive',
      'surface.host'
    ],
    evidenceCriteria: [{
      id: 'criterion.body-plan',
      basis: 'either',
      required: true,
      instruction:
        'Ground the core, support, sensor, and function-module plan in a current request or reference observation.'
    }],
    semanticSlots: [
      slot('body.core', 'Core', ['mass', 'radial'], 'Create one dominant central core.'),
      slot('body.support', 'Support', ['mass', 'segment', 'radial'], 'Create one stable support or locomotion base.', {
        parentSlotIds: ['body.core'],
        spatialRelations: ['below'],
        maxParts: 3
      }),
      slot('body.sensor', 'Sensor', ['feature', 'mass'], 'Create one forward-reading sensor or focal surface.', {
        parentSlotIds: ['body.core'],
        facing: 'forward',
        maxParts: 2
      }),
      slot('body.function-module', 'Function module', ['mass', 'segment', 'plate', 'radial'], 'Create one module that communicates the primary function.', {
        parentSlotIds: ['body.core'],
        maxParts: 3
      })
    ],
    attachmentPorts: [
      {
        id: 'port.role-module',
        type: 'role-prop',
        hostSlotIds: ['body.core', 'body.function-module'],
        capacity: 1,
        acceptsFacets: ['role-prop']
      },
      {
        id: 'port.surface-cue',
        type: 'surface-cue',
        hostSlotIds: ['body.core', 'body.function-module'],
        capacity: 2,
        acceptsFacets: ['surface-cue']
      },
      {
        id: 'port.silhouette-cue',
        type: 'silhouette-cue',
        hostSlotIds: ['body.core', 'body.function-module'],
        capacity: 1,
        acceptsFacets: ['silhouette-cue']
      }
    ],
    compatibility: [],
    reviewChecks: [{
      id: 'functional-construct.function-read',
      facets: ['silhouette', 'function'],
      cameras: ['native', 'perspective', 'side'],
      issue: 'connection',
      instruction:
        'Confirm the core, support, sensor direction, and primary module form a readable functional hierarchy.'
    }]
  }
];
