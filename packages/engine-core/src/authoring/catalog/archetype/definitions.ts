import { structuralRolePolicy as policy } from '../builders';
import {
  AUTHORING_PROFILE_SCHEMA_VERSION
} from '../../contract';
import type { ArchetypeDefinition } from '../contract';

export const archetypeDefinitions: readonly ArchetypeDefinition[] = [{
  id: 'archetype.composable-form',
  version: AUTHORING_PROFILE_SCHEMA_VERSION,
  label: 'Composable structural form',
  summary:
    'A subject-neutral module graph whose slots declare structural roles, quality stages, relationships, pairing, contact intent, and owned parts.',
  useWhen:
    'Use for any authored form that can be expressed through explicit core, axis, articulation, span, focal-frame, and accent modules.',
  instruction:
    'Declare only evidence-backed structural modules, complete silhouette before structure and focal stages, and preserve pairing or contact as data rather than slot-name conventions.',
  facets: ['composable'],
  capabilities: [
    'animation.anchor',
    'locomotion.paired',
    'rotary.drive',
    'surface.host'
  ],
  evidenceCriteria: [{
    id: 'criterion.structure-graph',
    basis: 'either',
    required: true,
    instruction:
      'Ground the declared structural module graph in the current request or reference observations.'
  }],
  structuralRolePolicies: [
    policy(
      'core',
      ['mass', 'radial'],
      ['silhouette', 'structure'],
      'Use for primary weight-bearing or enclosing masses; split only when the mass hierarchy materially changes.'
    ),
    policy(
      'axis',
      ['mass', 'segment'],
      ['silhouette', 'structure'],
      'Use for directional chains whose bend, taper, or extension organizes connected modules.'
    ),
    policy(
      'articulated',
      ['mass', 'segment'],
      ['silhouette', 'structure'],
      'Use for jointed appendages or supports without assigning an anatomical or manufactured identity.'
    ),
    policy(
      'rotary',
      ['radial'],
      ['silhouette', 'structure'],
      'Use for a compiler-owned radial drive, hub, or wheel whose rotation axis and attachment are derived from the structural host.'
    ),
    policy(
      'span',
      ['segment', 'plate'],
      ['silhouette', 'structure'],
      'Use for a supported planar reach such as a membrane, fin, panel, leaf, or cloth-like extension.'
    ),
    policy(
      'focal-frame',
      ['mass', 'plate', 'feature'],
      ['structure', 'focal'],
      'Use for host planes and compact glyphs that establish a controlled focal read after macro structure exists.'
    ),
    policy(
      'accent',
      ['mass', 'segment', 'plate', 'radial', 'feature'],
      ['silhouette', 'structure', 'focal'],
      'Use only for a recognition-bearing contour or focal cue that cannot be carried by an existing module.'
    )
  ],
  attachmentPorts: [
    {
      id: 'port.role-module',
      type: 'role-prop',
      hostStructuralRoles: ['core', 'articulated', 'rotary', 'span', 'accent'],
      capacity: 8,
      acceptsFacets: ['role-prop']
    },
    {
      id: 'port.surface-cue',
      type: 'surface-cue',
      hostStructuralRoles: [
        'core',
        'axis',
        'articulated',
        'rotary',
        'span',
        'focal-frame',
        'accent'
      ],
      capacity: 16,
      acceptsFacets: ['surface-cue']
    },
    {
      id: 'port.silhouette-cue',
      type: 'silhouette-cue',
      hostStructuralRoles: [
        'core',
        'axis',
        'articulated',
        'rotary',
        'span',
        'accent'
      ],
      capacity: 8,
      acceptsFacets: ['silhouette-cue']
    }
  ],
  compatibility: [],
  reviewChecks: [
    {
      id: 'composable-form.silhouette-read',
      facets: ['silhouette'],
      cameras: ['native', 'perspective', 'side', 'top'],
      issue: 'silhouette',
      instruction:
        'Confirm the core distribution and paired or directional modules read without surface detail.'
    },
    {
      id: 'composable-form.structure-read',
      facets: ['function'],
      cameras: ['perspective', 'side', 'top'],
      issue: 'connection',
      instruction:
        'Confirm parent chains, articulation, span supports, taper, and grounded contact preserve mid-frequency form.'
    },
    {
      id: 'composable-form.focal-read',
      facets: ['face'],
      cameras: ['front', 'perspective'],
      issue: 'focal_detail',
      instruction:
        'Confirm focal features are hosted by an established frame and do not substitute for missing structure.'
    }
  ]
}];
