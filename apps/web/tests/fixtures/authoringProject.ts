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
      name: 'Structural mechanic',
      target: 'glb',
      namespace: 'ashfox',
      modelPath: 'structural_mechanic',
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
      symmetry: { kind: 'bilateral', planeTwice: 0 },
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
        id: 'archetype.composable-form',
        version: AUTHORING_PROFILE_SCHEMA_VERSION
      },
      track: 'hero',
      faceMode: 'none',
      face: null,
      specialists: [{
        id: 'specialist.role-props',
        version: AUTHORING_PROFILE_SCHEMA_VERSION
      }, {
        id: 'specialist.static-loop',
        version: AUTHORING_PROFILE_SCHEMA_VERSION
      }],
      claims: [{
        authority: {
          id: 'archetype.composable-form',
          version: AUTHORING_PROFILE_SCHEMA_VERSION
        },
        criterionId: 'criterion.structure-graph',
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
        structuralRole: 'core',
        qualityStage: 'silhouette',
        partIds: ['torso'],
        parentSlotIds: [],
        spatialRelations: [],
        facing: null,
        symmetry: { kind: 'centered' },
        support: { kind: 'none' }
      }, {
        slotId: 'body.head',
        structuralRole: 'focal-frame',
        qualityStage: 'structure',
        partIds: ['head'],
        parentSlotIds: ['body.torso'],
        spatialRelations: ['above'],
        facing: 'forward',
        symmetry: { kind: 'centered' },
        support: { kind: 'none' }
      }, {
        slotId: 'body.arm-left',
        structuralRole: 'articulated',
        qualityStage: 'silhouette',
        partIds: ['arm.left'],
        parentSlotIds: ['body.torso'],
        spatialRelations: ['left'],
        facing: null,
        symmetry: { kind: 'paired', pairId: 'body.arms' },
        support: { kind: 'none' }
      }, {
        slotId: 'body.arm-right',
        structuralRole: 'articulated',
        qualityStage: 'silhouette',
        partIds: ['arm.right'],
        parentSlotIds: ['body.torso'],
        spatialRelations: ['right'],
        facing: null,
        symmetry: { kind: 'paired', pairId: 'body.arms' },
        support: { kind: 'none' }
      }, {
        slotId: 'body.leg-left',
        structuralRole: 'articulated',
        qualityStage: 'silhouette',
        partIds: [
          'leg.left',
          'sole.left',
          'toe.left',
          'claw.left'
        ],
        parentSlotIds: ['body.torso'],
        spatialRelations: ['left', 'below'],
        facing: 'forward',
        symmetry: { kind: 'paired', pairId: 'body.legs' },
        support: {
          kind: 'foot',
          contact: 'free',
          rootPartId: 'leg.left',
          solePartIds: ['sole.left'],
          digits: [{
            digitId: 'front',
            toePartIds: ['toe.left'],
            clawPartIds: ['claw.left']
          }]
        }
      }, {
        slotId: 'body.leg-right',
        structuralRole: 'articulated',
        qualityStage: 'silhouette',
        partIds: [
          'leg.right',
          'sole.right',
          'toe.right',
          'claw.right'
        ],
        parentSlotIds: ['body.torso'],
        spatialRelations: ['right', 'below'],
        facing: 'forward',
        symmetry: { kind: 'paired', pairId: 'body.legs' },
        support: {
          kind: 'foot',
          contact: 'free',
          rootPartId: 'leg.right',
          solePartIds: ['sole.right'],
          digits: [{
            digitId: 'front',
            toePartIds: ['toe.right'],
            clawPartIds: ['claw.right']
          }]
        }
      }, {
        slotId: 'body.front-mark',
        structuralRole: 'focal-frame',
        qualityStage: 'focal',
        partIds: ['front.mark'],
        parentSlotIds: ['body.head'],
        spatialRelations: ['front'],
        facing: 'forward',
        symmetry: { kind: 'centered' },
        support: { kind: 'none' }
      }],
      coverage: [{
        featureRef: 'intent.features.0',
        slotIds: ['body.head'],
        materialIds: []
      }, {
        featureRef: 'intent.features.1',
        slotIds: [],
        materialIds: ['metal']
      }, {
        featureRef: 'intent.features.2',
        slotIds: ['body.arm-left'],
        materialIds: []
      }],
      bindings: [{
        type: 'attachment',
        contributionId: 'contribution.role-prop',
        portId: 'port.role-module',
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
        partId: 'sole.left',
        parentPartId: 'leg.left',
        materialId: 'workwear',
        center: [-1, 1, 0],
        radii: [1, 1, 1],
        profile: 'block'
      }, {
        kind: 'mass',
        partId: 'toe.left',
        parentPartId: 'sole.left',
        materialId: 'workwear',
        center: [-1, 1, -2],
        radii: [1, 1, 1],
        profile: 'block'
      }, {
        kind: 'mass',
        partId: 'claw.left',
        parentPartId: 'toe.left',
        materialId: 'metal',
        center: [-1, 1, -4],
        radii: [1, 1, 1],
        profile: 'hard'
      }, {
        kind: 'mass',
        partId: 'leg.right',
        parentPartId: 'torso',
        materialId: 'workwear',
        center: [1, 2, 0],
        radii: [1, 1, 1],
        profile: 'block'
      }, {
        kind: 'mass',
        partId: 'sole.right',
        parentPartId: 'leg.right',
        materialId: 'workwear',
        center: [1, 1, 0],
        radii: [1, 1, 1],
        profile: 'block'
      }, {
        kind: 'mass',
        partId: 'toe.right',
        parentPartId: 'sole.right',
        materialId: 'workwear',
        center: [1, 1, -2],
        radii: [1, 1, 1],
        profile: 'block'
      }, {
        kind: 'mass',
        partId: 'claw.right',
        parentPartId: 'toe.right',
        materialId: 'metal',
        center: [1, 1, -4],
        radii: [1, 1, 1],
        profile: 'hard'
      }, {
        kind: 'feature',
        partId: 'front.mark',
        parentPartId: 'head',
        materialId: 'face',
        motif: 'patch',
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

export const createEssentialFullFaceProject = (): ProjectDocument => {
  const empty = createProjectFromInput(
    {
      id: 'project-authoring-full-face',
      name: 'Essential full-face contract',
      target: 'glb',
      namespace: 'ashfox',
      modelPath: 'essential_full_face_contract',
      createdAt: '2026-08-07T00:00:00.000Z'
    },
    'authoring-full-face-0001'
  );
  const planned = apply(empty, 'authoring-full-face-plan', [{
    name: 'project.intent.set',
    payload: {
      subject: 'Small game-piece animal icon',
      forward: 'south',
      grounding: 'free',
      symmetry: { kind: 'bilateral', planeTwice: 0 },
      features: ['Readable closed-mouth expression'],
      references: []
    }
  }, {
    name: 'project.authoring.configure',
    payload: {
      archetype: {
        id: 'archetype.composable-form',
        version: AUTHORING_PROFILE_SCHEMA_VERSION
      },
      track: 'essential',
      faceMode: 'full',
      face: {
        hostSlotId: 'focal.host',
        mouthState: 'closed',
        components: [{
          component: 'eye',
          form: 'eye',
          configuration: { kind: 'single', slotId: 'face.eye' },
          gaze: 'centered',
          palette: 'high-contrast',
          materialIds: ['eye_dark']
        }, {
          component: 'nasal',
          form: 'nose',
          slotIds: ['face.nasal'],
          materialIds: ['nose_tone']
        }, {
          component: 'oral',
          form: 'mouth',
          slotIds: ['face.oral'],
          materialIds: ['mouth_tone']
        }],
        exceptions: []
      },
      specialists: [],
      claims: [{
        authority: {
          id: 'archetype.composable-form',
          version: AUTHORING_PROFILE_SCHEMA_VERSION
        },
        criterionId: 'criterion.structure-graph',
        basis: 'requested',
        referenceIds: ['intent.subject'],
        rationale:
          'The requested small game-piece form needs a readable essential face.'
      }],
      slots: [{
        slotId: 'core.primary',
        structuralRole: 'core',
        qualityStage: 'silhouette',
        partIds: ['core_primary'],
        parentSlotIds: [],
        spatialRelations: [],
        facing: null,
        symmetry: { kind: 'centered' },
        support: { kind: 'none' }
      }, {
        slotId: 'focal.host',
        structuralRole: 'focal-frame',
        qualityStage: 'structure',
        partIds: ['focal_host'],
        parentSlotIds: ['core.primary'],
        spatialRelations: ['above'],
        facing: 'forward',
        symmetry: { kind: 'centered' },
        support: { kind: 'none' }
      }, ...(['eye', 'nasal', 'oral'] as const).map((component) => ({
        slotId: `face.${component}`,
        structuralRole: 'focal-frame' as const,
        qualityStage: 'focal' as const,
        partIds: [`face_${component}`],
        parentSlotIds: ['focal.host'],
        spatialRelations: [],
        facing: 'forward' as const,
        symmetry: { kind: 'centered' as const },
        support: { kind: 'none' as const }
      }))],
      coverage: [{
        featureRef: 'intent.features.0',
        slotIds: ['face.oral'],
        materialIds: []
      }],
      bindings: []
    }
  }]);
  return apply(planned, 'authoring-full-face-model', [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'mass',
        partId: 'core_primary',
        parentPartId: null,
        materialId: 'body',
        center: [0, 0, 0],
        radii: [2, 2, 2],
        profile: 'block'
      }, {
        kind: 'mass',
        partId: 'focal_host',
        parentPartId: 'core_primary',
        materialId: 'face_base',
        center: [0, 5, 0],
        radii: [3, 3, 2],
        profile: 'block'
      }, {
        kind: 'feature',
        partId: 'face_eye',
        parentPartId: 'focal_host',
        materialId: 'eye_dark',
        motif: 'eye',
        glyph: 'square',
        face: 'south',
        anchor: [0, 6, 2],
        size: [4, 3]
      }, {
        kind: 'feature',
        partId: 'face_nasal',
        parentPartId: 'focal_host',
        materialId: 'nose_tone',
        motif: 'nose',
        glyph: 'snout',
        face: 'south',
        anchor: [0, 4, 2],
        size: [2, 2]
      }, {
        kind: 'feature',
        partId: 'face_oral',
        parentPartId: 'focal_host',
        materialId: 'mouth_tone',
        motif: 'mouth',
        glyph: 'neutral',
        face: 'south',
        anchor: [0, 2, 2],
        size: [2, 1]
      }],
      materials: [{
        id: 'body',
        baseColor: '#53677A'
      }, {
        id: 'face_base',
        baseColor: '#B7C8D8'
      }, {
        id: 'eye_dark',
        baseColor: '#111827'
      }, {
        id: 'nose_tone',
        baseColor: '#76556A'
      }, {
        id: 'mouth_tone',
        baseColor: '#512D3A'
      }]
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
    track: profile.track,
    faceMode: profile.faceMode,
    face: profile.face,
    specialists: profile.specialists.filter(
      (reference) =>
        includeMotion || reference.id !== 'specialist.static-loop'
    ),
    claims: profile.claims.filter(
      (claim) =>
        includeMotion || claim.authority.id !== 'specialist.static-loop'
    ),
    slots: profile.slots,
    coverage: profile.coverage,
    bindings: profile.bindings.filter(
      (binding) => includeMotion || binding.type !== 'motion'
    )
  };
};
