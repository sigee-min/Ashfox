import { contribution } from '../builders';
import {
  AUTHORING_PROFILE_SCHEMA_VERSION
} from '../../contract';
import type { SpecialistDefinition } from '../contract';

export const specialistDefinitions: readonly SpecialistDefinition[] = [
  {
    id: 'specialist.role-props',
    version: AUTHORING_PROFILE_SCHEMA_VERSION,
    label: 'Role-bearing props',
    summary: 'Communicates a practical role through one restrained tool, pack, or utility module.',
    useWhen: 'Use when the requested role must survive at native viewing size.',
    instruction: 'Attach one role-defining prop and keep secondary cues in broad surface regions.',
    facets: ['role-prop'],
    capabilities: ['cue.role'],
    evidenceCriteria: [{
      id: 'criterion.role-cue',
      basis: 'either',
      required: true,
      instruction:
        'Identify the requested or observed practical role that requires one readable prop.'
    }],
    attachmentRequirements: [{
      op: 'requires-port',
      requirementId: 'requirement.role-prop',
      portType: 'role-prop'
    }],
    contributions: [contribution(
      'contribution.role-prop',
      'Role prop',
      'requirement.role-prop',
      ['mass', 'segment', 'plate', 'feature'],
      'Create one compact tool, utility pack, or function-bearing role cue.',
      { maxParts: 3 }
    )],
    bindingRequirements: [],
    compatibility: [{
      op: 'provides-capability',
      capability: 'surface.host'
    }],
    reviewChecks: [{
      id: 'role-props.role-read',
      facets: ['role-prop'],
      cameras: ['native', 'front', 'perspective'],
      issue: 'focal_detail',
      instruction: 'Confirm one prop communicates the role without decorative geometry noise.'
    }]
  },
  {
    id: 'specialist.hard-surface',
    version: AUTHORING_PROFILE_SCHEMA_VERSION,
    label: 'Hard-surface construction',
    summary: 'Adds one readable drive, housing, hinge, sensor, or chassis construction cue.',
    useWhen: 'Use when manufactured construction is an important requested or observed cue.',
    instruction: 'Expose one construction-defining relation and keep the remaining surfaces broad.',
    facets: ['surface-cue', 'hard-surface'],
    capabilities: ['cue.manufactured'],
    evidenceCriteria: [{
      id: 'criterion.construction-cue',
      basis: 'either',
      required: true,
      instruction:
        'Identify the requested or observed manufactured construction cue.'
    }],
    attachmentRequirements: [{
      op: 'requires-port',
      requirementId: 'requirement.hard-surface',
      portType: 'surface-cue'
    }],
    contributions: [contribution(
      'contribution.hard-surface',
      'Construction cue',
      'requirement.hard-surface',
      ['feature', 'mass', 'segment', 'plate', 'radial'],
      'Create one visible drive, housing, hinge, sensor, exhaust, or chassis cue.',
      { maxParts: 3 }
    )],
    bindingRequirements: [],
    compatibility: [{ op: 'provides-capability', capability: 'surface.host' }],
    reviewChecks: [{
      id: 'hard-surface.construction-read',
      facets: ['hard-surface'],
      cameras: ['native', 'side', 'perspective'],
      issue: 'connection',
      instruction: 'Confirm one believable construction cue has a readable axis or load-bearing attachment.'
    }]
  },
  {
    id: 'specialist.decay-cues',
    version: AUTHORING_PROFILE_SCHEMA_VERSION,
    label: 'Decay cues',
    summary: 'Adds one hollow, damaged, exposed, or deliberately asymmetric surface region.',
    useWhen: 'Use when age, damage, or decay is explicit in evidence or request.',
    instruction: 'Preserve the body plan and concentrate decay in one broad readable cue.',
    facets: ['surface-cue', 'decay'],
    capabilities: ['cue.decay'],
    evidenceCriteria: [{
      id: 'criterion.decay-cue',
      basis: 'either',
      required: true,
      instruction: 'Identify the requested or observed decay cue.'
    }],
    attachmentRequirements: [{
      op: 'requires-port',
      requirementId: 'requirement.decay',
      portType: 'surface-cue'
    }],
    contributions: [contribution(
      'contribution.decay',
      'Decay cue',
      'requirement.decay',
      ['feature', 'mass', 'plate'],
      'Create one hollow mark, broad damaged patch, exposed structure, or intentional asymmetry.',
      { maxParts: 3 }
    )],
    bindingRequirements: [],
    compatibility: [{ op: 'provides-capability', capability: 'surface.host' }],
    reviewChecks: [{
      id: 'decay-cues.read',
      facets: ['decay'],
      cameras: ['native', 'front', 'perspective'],
      issue: 'material',
      instruction: 'Confirm decay reads through one broad region rather than repeated chips or cubes.'
    }]
  },
  {
    id: 'specialist.arcane-cues',
    version: AUTHORING_PROFILE_SCHEMA_VERSION,
    label: 'Arcane cues',
    summary: 'Adds one magical focus and one restrained luminous or rune-bearing surface cue.',
    useWhen: 'Use when magic is explicit in evidence or request.',
    instruction: 'Choose one dominant focus and express secondary signals as surface detail.',
    facets: ['surface-cue', 'arcane'],
    capabilities: ['cue.arcane'],
    evidenceCriteria: [{
      id: 'criterion.arcane-cue',
      basis: 'either',
      required: true,
      instruction: 'Identify the requested or observed arcane focus.'
    }],
    attachmentRequirements: [{
      op: 'requires-port',
      requirementId: 'requirement.arcane',
      portType: 'surface-cue'
    }],
    contributions: [contribution(
      'contribution.arcane',
      'Arcane focus',
      'requirement.arcane',
      ['feature', 'mass', 'segment', 'plate', 'radial'],
      'Create one focus, core, horn, crown, staff, or rune-bearing region.',
      { maxParts: 3 }
    )],
    bindingRequirements: [],
    compatibility: [{ op: 'provides-capability', capability: 'surface.host' }],
    reviewChecks: [{
      id: 'arcane-cues.focus',
      facets: ['arcane'],
      cameras: ['native', 'perspective'],
      issue: 'focal_detail',
      instruction: 'Confirm one magical focus dominates without a cloud of secondary detail.'
    }]
  },
  {
    id: 'specialist.organic-cues',
    version: AUTHORING_PROFILE_SCHEMA_VERSION,
    label: 'Organic surface cues',
    summary: 'Adds one growth, bark, foliage, fur, or other natural material cue.',
    useWhen: 'Use when organic material or growth is explicit in evidence or request.',
    instruction: 'Use broad natural material regions plus one unmistakable surface cue.',
    facets: ['surface-cue', 'organic'],
    capabilities: ['cue.organic'],
    evidenceCriteria: [{
      id: 'criterion.organic-cue',
      basis: 'either',
      required: true,
      instruction: 'Identify the requested or observed organic material cue.'
    }],
    attachmentRequirements: [{
      op: 'requires-port',
      requirementId: 'requirement.organic',
      portType: 'surface-cue'
    }],
    contributions: [contribution(
      'contribution.organic',
      'Organic cue',
      'requirement.organic',
      ['feature', 'mass', 'segment', 'plate'],
      'Create one growth, bark, foliage, fur, or other readable natural cue.',
      { maxParts: 3 }
    )],
    bindingRequirements: [],
    compatibility: [{ op: 'provides-capability', capability: 'surface.host' }],
    reviewChecks: [{
      id: 'organic-cues.read',
      facets: ['organic'],
      cameras: ['native', 'side', 'perspective'],
      issue: 'material',
      instruction: 'Confirm one broad organic cue survives at native size.'
    }]
  },
  {
    id: 'specialist.protective-shell',
    version: AUTHORING_PROFILE_SCHEMA_VERSION,
    label: 'Protective silhouette',
    summary: 'Adds one helmet, shell, shield, visor, or broad protective contour.',
    useWhen: 'Use when protection or armor is explicit in evidence or request.',
    instruction: 'Change one clear contour while preserving the underlying body plan.',
    facets: ['silhouette-cue', 'protective'],
    capabilities: ['cue.protective'],
    evidenceCriteria: [{
      id: 'criterion.protective-cue',
      basis: 'either',
      required: true,
      instruction: 'Identify the requested or observed protective contour.'
    }],
    attachmentRequirements: [{
      op: 'requires-port',
      requirementId: 'requirement.protective-shell',
      portType: 'silhouette-cue'
    }],
    contributions: [contribution(
      'contribution.protective-shell',
      'Protective shell cue',
      'requirement.protective-shell',
      ['feature', 'mass', 'plate'],
      'Create one helmet, shell, shield, visor, or broad protective contour.',
      { maxParts: 3 }
    )],
    bindingRequirements: [],
    compatibility: [{ op: 'provides-capability', capability: 'surface.host' }],
    reviewChecks: [{
      id: 'protective-shell.read',
      facets: ['protective'],
      cameras: ['native', 'front', 'side'],
      issue: 'silhouette',
      instruction: 'Confirm protection changes one clear contour without swallowing the body plan.'
    }]
  },
  {
    id: 'specialist.static-loop',
    version: AUTHORING_PROFILE_SCHEMA_VERSION,
    label: 'Held presentation loop',
    summary: 'Defines a deliberate held or minimally moving presentation loop.',
    useWhen: 'Use when the canonical source needs a held presentation clip; static delivery may omit it without changing authority.',
    instruction: 'Preserve a balanced readable pose with no resting intersections.',
    facets: ['motion'],
    capabilities: ['animation.idle'],
    evidenceCriteria: [{
      id: 'criterion.presentation-motion',
      basis: 'requested',
      required: true,
      instruction: 'Identify the requested held presentation motion.'
    }],
    attachmentRequirements: [],
    contributions: [],
    bindingRequirements: [{
      type: 'motion',
      allowedRoles: ['idle'],
      minBindings: 1,
      maxBindings: 1
    }],
    compatibility: [
      { op: 'provides-capability', capability: 'animation.anchor' }
    ],
    reviewChecks: [{
      id: 'static-loop.pose',
      facets: ['motion'],
      cameras: ['perspective', 'side'],
      issue: 'motion',
      instruction: 'Confirm the held loop preserves silhouette, grounding, and connection clarity.'
    }]
  },
  {
    id: 'specialist.alternating-gait',
    version: AUTHORING_PROFILE_SCHEMA_VERSION,
    label: 'Alternating paired gait',
    summary: 'Defines an alternating locomotion cycle for paired limbs.',
    useWhen: 'Use when paired limbs must communicate a walk or trot.',
    instruction: 'Alternate paired supports while preserving ground contact and forward direction.',
    facets: ['motion', 'gait'],
    capabilities: ['animation.gait'],
    evidenceCriteria: [{
      id: 'criterion.paired-gait',
      basis: 'requested',
      required: true,
      instruction: 'Identify the requested alternating paired-limb gait.'
    }],
    attachmentRequirements: [],
    contributions: [],
    bindingRequirements: [{
      type: 'motion',
      allowedRoles: ['loop'],
      minBindings: 1,
      maxBindings: 1
    }],
    compatibility: [
      { op: 'provides-capability', capability: 'locomotion.paired' },
      { op: 'forbids', path: 'selection.specialistIds', value: 'specialist.rotary-cycle' }
    ],
    reviewChecks: [{
      id: 'alternating-gait.support',
      facets: ['motion', 'gait'],
      cameras: ['side', 'perspective'],
      issue: 'motion',
      instruction: 'Confirm paired supports alternate without sliding or reversing the forward axis.'
    }]
  },
  {
    id: 'specialist.rotary-cycle',
    version: AUTHORING_PROFILE_SCHEMA_VERSION,
    label: 'Rotary function cycle',
    summary: 'Defines a repeatable rotation around one visible functional axis.',
    useWhen: 'Use when a drive, wheel, rotor, or core should express the primary function.',
    instruction: 'Animate one readable axis and keep secondary motion subordinate.',
    facets: ['motion', 'rotary'],
    capabilities: ['animation.rotary'],
    evidenceCriteria: [{
      id: 'criterion.rotary-motion',
      basis: 'requested',
      required: true,
      instruction: 'Identify the requested rotary function cycle.'
    }],
    attachmentRequirements: [],
    contributions: [],
    bindingRequirements: [{
      type: 'motion',
      allowedRoles: ['loop'],
      minBindings: 1,
      maxBindings: 1
    }],
    compatibility: [
      { op: 'provides-capability', capability: 'rotary.drive' },
      { op: 'forbids', path: 'selection.specialistIds', value: 'specialist.alternating-gait' }
    ],
    reviewChecks: [{
      id: 'rotary-cycle.axis',
      facets: ['motion', 'rotary'],
      cameras: ['side', 'perspective'],
      issue: 'pivot',
      instruction: 'Confirm the rotating contribution uses the visible functional axis without drift.'
    }]
  }
];
