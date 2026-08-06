import {
  AUTHORING_PROFILE_SCHEMA_VERSION,
  createProjectFromInput,
  executeAgentCommandBatch,
  type ProjectCommandOperation,
  type ProjectDocument
} from '@ashfox/engine-core';

const apply = (
  document: ProjectDocument,
  batchId: string,
  operations: readonly ProjectCommandOperation[]
): ProjectDocument => {
  const result = executeAgentCommandBatch(
    document,
    {
      batchId,
      baseProjectId: document.id,
      baseRevision: document.revision,
      operations
    }
  );
  if (!result.ok) {
    throw new Error(
      `${batchId} failed at ${result.error.path ?? '$'}: ` +
      result.error.message
    );
  }
  return result.document;
};

export const createAuthoringProject = (): ProjectDocument => {
  const empty = createProjectFromInput(
    {
      id: 'project-authoring-mechanic',
      name: 'Archetype mechanic',
      target: 'glb',
      namespace: 'ashfox',
      modelPath: 'archetype_mechanic',
      createdAt: '2026-08-06T00:00:00.000Z'
    },
    'authoring-fixture-0001'
  );
  const planned = apply(empty, 'authoring-fixture-plan', [{
    name: 'project.intent.set',
    payload: {
      subject: 'Compact workshop mechanic',
      forward: 'north',
      grounding: 'free',
      features: [
        'Oversized head',
        'Compact utility pack',
        'Held presentation loop'
      ],
      references: [{
        id: 'reference.mechanic',
        kind: 'image',
        description:
          'A compact upright workshop character with a visible tool pack.',
        cues: [
          'head, torso, paired arms, and paired legs',
          'utility pack establishes the workshop role'
        ]
      }]
    }
  }, {
    name: 'project.authoring.configure',
    payload: {
      archetype: {
        id: 'archetype.mini-biped',
        version: AUTHORING_PROFILE_SCHEMA_VERSION
      },
      specialists: [{
        id: 'specialist.role-props',
        version: AUTHORING_PROFILE_SCHEMA_VERSION
      }, {
        id: 'specialist.static-loop',
        version: AUTHORING_PROFILE_SCHEMA_VERSION
      }],
      claims: [{
        authority: {
          id: 'archetype.mini-biped',
          version: AUTHORING_PROFILE_SCHEMA_VERSION
        },
        criterionId: 'criterion.body-plan',
        basis: 'observed',
        referenceIds: ['reference.mechanic'],
        rationale:
          'The reference has one head, torso, two arms, and two legs.'
      }, {
        authority: {
          id: 'specialist.role-props',
          version: AUTHORING_PROFILE_SCHEMA_VERSION
        },
        criterionId: 'criterion.role-cue',
        basis: 'observed',
        referenceIds: ['reference.mechanic'],
        rationale:
          'The visible utility pack is a clear workshop-role cue.'
      }, {
        authority: {
          id: 'specialist.static-loop',
          version: AUTHORING_PROFILE_SCHEMA_VERSION
        },
        criterionId: 'criterion.presentation-motion',
        basis: 'requested',
        referenceIds: ['intent.features.2'],
        rationale:
          'The requested delivery includes a deliberate held presentation loop.'
      }],
      slots: [{
        slotId: 'body.torso',
        partIds: ['torso']
      }, {
        slotId: 'body.head',
        partIds: ['head']
      }, {
        slotId: 'body.arm-left',
        partIds: ['arm.left']
      }, {
        slotId: 'body.arm-right',
        partIds: ['arm.right']
      }, {
        slotId: 'body.leg-left',
        partIds: ['leg.left']
      }, {
        slotId: 'body.leg-right',
        partIds: ['leg.right']
      }, {
        slotId: 'body.face',
        partIds: ['face.eye']
      }],
      bindings: [{
        type: 'attachment',
        contributionId: 'contribution.role-prop',
        portId: 'port.hand-or-module',
        hostSlotId: 'body.torso',
        partIds: ['utility.pack']
      }, {
        type: 'motion',
        specialist: {
          id: 'specialist.static-loop',
          version: AUTHORING_PROFILE_SCHEMA_VERSION
        },
        clipId: 'idle',
        role: 'idle'
      }]
    }
  }]);
  const modeled = apply(planned, 'authoring-fixture-model', [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'mass',
        partId: 'torso',
        parentPartId: null,
        materialId: 'workwear',
        center: [0, 5, 0],
        radii: [2, 2, 2],
        profile: 'block'
      }, {
        kind: 'mass',
        partId: 'head',
        parentPartId: 'torso',
        materialId: 'workwear',
        center: [0, 9, 0],
        radii: [2, 2, 2],
        profile: 'block'
      }, {
        kind: 'mass',
        partId: 'arm.left',
        parentPartId: 'torso',
        materialId: 'workwear',
        center: [-3, 5, 0],
        radii: [1, 2, 1],
        profile: 'block'
      }, {
        kind: 'mass',
        partId: 'arm.right',
        parentPartId: 'torso',
        materialId: 'workwear',
        center: [3, 5, 0],
        radii: [1, 2, 1],
        profile: 'block'
      }, {
        kind: 'mass',
        partId: 'leg.left',
        parentPartId: 'torso',
        materialId: 'workwear',
        center: [-1, 2, 0],
        radii: [1, 1, 1],
        profile: 'block'
      }, {
        kind: 'mass',
        partId: 'leg.right',
        parentPartId: 'torso',
        materialId: 'workwear',
        center: [1, 2, 0],
        radii: [1, 1, 1],
        profile: 'block'
      }, {
        kind: 'feature',
        partId: 'face.eye',
        parentPartId: 'head',
        materialId: 'face',
        motif: 'eye',
        glyph: 'square',
        face: 'north',
        anchor: [0, 9, -2],
        size: [2, 2]
      }, {
        kind: 'mass',
        partId: 'utility.pack',
        parentPartId: 'torso',
        materialId: 'metal',
        center: [0, 5, 3],
        radii: [1, 1, 1],
        profile: 'block'
      }],
      materials: [{
        id: 'workwear',
        baseColor: '#7A5B3A'
      }, {
        id: 'face',
        baseColor: '#D9B45C'
      }, {
        id: 'metal',
        baseColor: '#64717A'
      }]
    }
  }]);
  return apply(modeled, 'authoring-fixture-idle', [{
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'idle',
      role: 'idle',
      durationFrames: 20,
      static: true
    }
  }]);
};

export const authoringSelectionFor = (
  document: ProjectDocument,
  options: { animationSupported?: boolean } = {}
) => {
  const profile = document.authoringProfile;
  if (!profile) throw new Error('Authoring profile is unavailable.');
  const includeMotion = options.animationSupported !== false;
  return {
    archetype: profile.archetype,
    specialists: profile.specialists.filter(
      (reference) =>
        includeMotion || reference.id !== 'specialist.static-loop'
    ),
    claims: profile.claims.filter(
      (claim) =>
        includeMotion || claim.authority.id !== 'specialist.static-loop'
    ),
    slots: profile.slots,
    bindings: profile.bindings.filter(
      (binding) => includeMotion || binding.type !== 'motion'
    )
  };
};
