import { PROJECT_APPEARANCE_SPECIFICATION } from '../appearance/contract';
import { PROJECT_SEMANTIC_IDENTIFIER_PATTERN } from '../identifier';

/**
 * The closed, data-only Intent Program 1 language contract.
 *
 * Readers, diagnostics, documentation, and capability tests consume this
 * vocabulary. Parser control flow and compiler policy do not belong here.
 */
export const INTENT_PROGRAM_LANGUAGE_VERSION = 1 as const;
export const INTENT_PROGRAM_COMPILER_VERSION = 1 as const;
export const INTENT_PROGRAM_SOURCE_VERSION = 1 as const;
export const INTENT_PROGRAM_SOURCE_MAX_LENGTH = 20_000;

export const INTENT_PROGRAM_IDENTIFIER_PATTERN =
  PROJECT_SEMANTIC_IDENTIFIER_PATTERN;

const ATTACHMENT_LANES_BY_ANCHOR = Object.freeze({
  front: Object.freeze(['center', 'upper', 'lower'] as const),
  rear: Object.freeze(['center', 'upper', 'lower'] as const),
  top: Object.freeze(['leading', 'center', 'trailing'] as const),
  bottom: Object.freeze(['leading', 'center', 'trailing'] as const),
  left: Object.freeze(['leading', 'center', 'trailing', 'upper', 'lower'] as const),
  right: Object.freeze(['leading', 'center', 'trailing', 'upper', 'lower'] as const),
  sides: Object.freeze(['leading', 'center', 'trailing', 'upper', 'lower'] as const)
});

const frozenTuple = <T extends readonly string[]>(value: T): T =>
  Object.freeze(value);

const MODULE_RELATION_TUPLES = Object.freeze([
  ...(['mass', 'chain', 'radial'] as const).flatMap((kind) => [
    frozenTuple([kind, 'single', 'front', 'forward'] as const),
    frozenTuple([kind, 'single', 'rear', 'rearward'] as const),
    frozenTuple([kind, 'single', 'top', 'up'] as const),
    frozenTuple([kind, 'single', 'bottom', 'down'] as const),
    frozenTuple([kind, 'single', 'left', 'left'] as const),
    frozenTuple([kind, 'single', 'right', 'right'] as const)
  ] as const),
  frozenTuple(['limb', 'paired', 'sides', 'forward'] as const),
  frozenTuple(['limb', 'paired', 'sides', 'rearward'] as const),
  frozenTuple(['limb', 'paired', 'sides', 'up'] as const),
  frozenTuple(['limb', 'paired', 'sides', 'down'] as const),
  frozenTuple(['wheel', 'paired', 'sides', 'down'] as const)
] as const);

const SURFACE_RELATION_TUPLES = Object.freeze([
  frozenTuple(['single', 'front', 'forward'] as const),
  frozenTuple(['single', 'rear', 'rearward'] as const),
  frozenTuple(['single', 'top', 'up'] as const),
  frozenTuple(['single', 'bottom', 'down'] as const),
  frozenTuple(['single', 'left', 'left'] as const),
  frozenTuple(['single', 'right', 'right'] as const),
  frozenTuple(['paired', 'sides', 'outward'] as const),
  frozenTuple(['paired', 'sides', 'up'] as const),
  frozenTuple(['paired', 'sides', 'down'] as const),
  frozenTuple(['paired', 'sides', 'forward'] as const),
  frozenTuple(['paired', 'sides', 'rearward'] as const)
] as const);

const STRUCTURAL_HOST_KINDS = Object.freeze([
  'core', 'mass', 'chain', 'radial'
] as const);

const SUPPORT_KINDS_BY_DOMAIN = Object.freeze({
  organism: Object.freeze(['none', 'feet'] as const),
  constructed: Object.freeze(['none', 'feet', 'base', 'wheels'] as const)
});

const SUPPORT_CONTACT_CARDINALITY_BY_KIND = Object.freeze({
  none: Object.freeze({ min: 0, max: 0 }),
  feet: Object.freeze({ min: 1, max: null }),
  base: Object.freeze({ min: 1, max: 1 }),
  wheels: Object.freeze({ min: 1, max: null })
});

const PRESENTATION_SLOT = Object.freeze({
  anchor: 'front', lane: 'center'
} as const);

export const INTENT_PROGRAM_LANGUAGE_SPECIFICATION = Object.freeze({
  version: INTENT_PROGRAM_LANGUAGE_VERSION,
  provenance: Object.freeze({
    compilerVersion: INTENT_PROGRAM_COMPILER_VERSION,
    sourceVersion: INTENT_PROGRAM_SOURCE_VERSION,
    specificationVersion: INTENT_PROGRAM_LANGUAGE_VERSION,
    digestAlgorithm: 'sha256',
    digestHexLength: 64
  }),
  identifier: Object.freeze({
    description: 'lower-kebab-case',
    example: 'front-leg',
    pattern: INTENT_PROGRAM_IDENTIFIER_PATTERN
  }),
  rootBlocks: Object.freeze([
    'metadata', 'model', 'animation', 'appearance'
  ] as const),
  metadata: Object.freeze({
    tracks: Object.freeze(['essential', 'hero'] as const),
    domains: Object.freeze(['organism', 'constructed'] as const)
  }),
  supportKinds: Object.freeze(['none', 'feet', 'base', 'wheels'] as const),
  anchors: Object.freeze([
    'front', 'rear', 'top', 'bottom', 'left', 'right', 'sides'
  ] as const),
  growth: Object.freeze([
    'forward', 'rearward', 'up', 'down', 'left', 'right', 'outward'
  ] as const),
  lanes: Object.freeze([
    'leading', 'center', 'trailing', 'upper', 'lower'
  ] as const),
  relations: Object.freeze({
    structuralHostKinds: STRUCTURAL_HOST_KINDS,
    lanesByAnchor: ATTACHMENT_LANES_BY_ANCHOR,
    moduleTuples: MODULE_RELATION_TUPLES,
    surfaceTuples: SURFACE_RELATION_TUPLES
  }),
  supportCompatibility: Object.freeze({
    kindsByDomain: SUPPORT_KINDS_BY_DOMAIN,
    contactReference: Object.freeze({ namespace: 'body' } as const),
    contactsUnique: true,
    contactCardinalityByKind: SUPPORT_CONTACT_CARDINALITY_BY_KIND,
    contactRequirementsByKind: Object.freeze({
      feet: Object.freeze({
        supportKind: 'feet',
        moduleKinds: Object.freeze(['limb'] as const),
        requiredGrowth: 'down'
      }),
      wheels: Object.freeze({
        supportKind: 'wheels',
        moduleKinds: Object.freeze(['wheel'] as const),
        requiredGrowth: 'down'
      }),
      base: Object.freeze({
        supportKind: 'base',
        moduleKinds: STRUCTURAL_HOST_KINDS,
        requiredGrowth: null
      })
    }),
    requiredModuleContacts: Object.freeze([
      Object.freeze({ moduleKind: 'wheel', supportKind: 'wheels' } as const)
    ] as const)
  }),
  symmetryCompatibility: Object.freeze({
    singleLateralAttachment: Object.freeze({
      whenSymmetry: 'bilateral',
      cardinality: 'single',
      appliesTo: Object.freeze(['body', 'surface'] as const),
      anchors: Object.freeze(['left', 'right'] as const),
      requiredSymmetry: 'asymmetric'
    })
  }),
  invariants: Object.freeze({
    name: Object.freeze({
      normalization: 'trim-collapse-whitespace',
      nonEmpty: true
    } as const),
    identifiers: Object.freeze({
      uniqueWithinNamespaces: Object.freeze(['body', 'surfaces'] as const)
    }),
    body: Object.freeze({
      core: Object.freeze({
        kind: 'core', cardinality: 'single', exactCount: 1
      } as const),
      parentGraph: 'acyclic'
    } as const),
    references: Object.freeze({
      bodyParent: Object.freeze({
        namespace: 'body', allowedKinds: 'relations.structuralHostKinds'
      } as const),
      surfaceParent: Object.freeze({
        namespace: 'body', allowedKinds: 'relations.structuralHostKinds'
      } as const),
      surfaceShape: Object.freeze({ namespace: 'surfaces' } as const),
      faceParent: Object.freeze({
        namespace: 'body', allowedKinds: 'relations.structuralHostKinds'
      } as const),
      focalParent: Object.freeze({
        namespace: 'body', allowedKinds: 'relations.structuralHostKinds'
      } as const),
      animationTarget: Object.freeze({
        namespace: 'body', allowedKinds: 'relations.structuralHostKinds'
      } as const)
    }),
    attachmentSlots: Object.freeze({
      keyFields: Object.freeze(['parent', 'anchor', 'lane'] as const),
      capacityByClaimKind: Object.freeze({ body: 1, surface: 2 } as const),
      mutuallyExclusiveClaimKinds: Object.freeze([
        Object.freeze(['body', 'surface'] as const)
      ] as const),
      presentation: Object.freeze({
        slot: PRESENTATION_SLOT,
        claimKinds: Object.freeze([
          'body', 'surface', 'face', 'focal'
        ] as const),
        exclusiveClaimKinds: Object.freeze(['face', 'focal'] as const)
      })
    }),
    presentationByTrack: Object.freeze({
      hero: Object.freeze({
        exactClaimCount: 1,
        claimKinds: Object.freeze(['face', 'focal'] as const),
        forbiddenClaimKinds: Object.freeze([] as const)
      }),
      essential: Object.freeze({
        exactClaimCount: null,
        claimKinds: Object.freeze(['face', 'focal'] as const),
        forbiddenClaimKinds: Object.freeze(['focal'] as const)
      })
    })
  }),
  surfaceShapes: Object.freeze({
    axis: Object.freeze(['vertical', 'longitudinal', 'transverse'] as const),
    span: Object.freeze(['short', 'medium', 'long'] as const),
    chord: Object.freeze(['narrow', 'medium', 'broad'] as const),
    tip: Object.freeze([
      'pointed', 'rounded', 'flat', 'flared', 'forked'
    ] as const),
    offset: Object.freeze([
      'center', 'anterior', 'posterior', 'dorsal', 'ventral', 'medial',
      'distal'
    ] as const),
    edge: Object.freeze(['straight', 'convex', 'concave'] as const),
    compatibility: Object.freeze({
      parallelGrowthByAxis: Object.freeze({
        vertical: Object.freeze(['up', 'down'] as const),
        longitudinal: Object.freeze(['forward', 'rearward'] as const),
        transverse: Object.freeze(['left', 'right', 'outward'] as const)
      }),
      allowedOffsetsByAxis: Object.freeze({
        vertical: Object.freeze(['center', 'dorsal', 'ventral'] as const),
        longitudinal: Object.freeze([
          'center', 'anterior', 'posterior'
        ] as const),
        transverse: Object.freeze(['center', 'medial', 'distal'] as const)
      })
    })
  }),
  model: Object.freeze({
    forwardDirections: Object.freeze(['north', 'south', 'east', 'west'] as const),
    symmetries: Object.freeze(['bilateral', 'asymmetric'] as const),
    moduleKinds: Object.freeze([
      'core', 'mass', 'chain', 'limb', 'wheel', 'radial'
    ] as const),
    cardinalities: Object.freeze(['single', 'paired'] as const),
    surfaceRoles: Object.freeze(['wing', 'fin', 'sail', 'panel'] as const),
    faceKinds: Object.freeze(['none', 'full'] as const),
    eyeConfigurations: Object.freeze(['single', 'paired'] as const),
    gazeModes: Object.freeze(['center'] as const),
    noseModes: Object.freeze(['present', 'absent'] as const),
    mouthModes: Object.freeze([
      'absent', 'neutral', 'beak', 'fang'
    ] as const)
  }),
  animation: Object.freeze({
    idleModes: Object.freeze(['still', 'breathe', 'scan'] as const)
  }),
  appearance: Object.freeze({
    palettes: Object.freeze([
      'natural', 'ember', 'ocean', 'noir', 'metal', 'gold'
    ] as const),
    specification: PROJECT_APPEARANCE_SPECIFICATION
  }),
  statements: Object.freeze({
    root: Object.freeze({
      allowed: 'rootBlocks',
      required: 'rootBlocks',
      cardinalityPerBlock: Object.freeze({ min: 1, max: 1 })
    }),
    metadata: Object.freeze({
      name: Object.freeze({
        cardinality: 1,
        sourceTokens: Object.freeze(['name', 'text'] as const)
      }),
      track: Object.freeze({
        enum: 'metadata.tracks', cardinality: 1,
        sourceTokens: Object.freeze(['track', 'value'] as const)
      }),
      domain: Object.freeze({
        enum: 'metadata.domains', cardinality: 1,
        sourceTokens: Object.freeze(['domain', 'value'] as const)
      })
    }),
    model: Object.freeze({
      orientation: Object.freeze({
        sourceTokens: Object.freeze([
          'orientation', 'forward', 'direction'
        ] as const),
        fields: Object.freeze({
          forward: Object.freeze({
            enum: 'model.forwardDirections'
          })
        }),
        cardinality: 1
      }),
      symmetry: Object.freeze({
        enum: 'model.symmetries', cardinality: 1,
        sourceTokens: Object.freeze(['symmetry', 'value'] as const)
      }),
      support: Object.freeze({
        sourceTokensByKind: Object.freeze({
          none: Object.freeze(['support', 'kind'] as const),
          contacts: Object.freeze([
            'support', 'kind', 'contacts', 'contactIds'
          ] as const)
        }),
        fields: Object.freeze({
          kind: Object.freeze({
            enum: 'supportKinds'
          }),
          contacts: Object.freeze({
            cardinalityByKind: SUPPORT_CONTACT_CARDINALITY_BY_KIND
          })
        }),
        cardinality: 1
      }),
      body: Object.freeze({
        cardinality: Object.freeze({ min: 1, max: null }),
        sourceHeader: Object.freeze(['body'] as const),
        sourceTokensByKind: Object.freeze({
          core: Object.freeze(['kind', 'id'] as const),
          attached: Object.freeze([
            'kind', 'id', 'cardinality', 'parent', 'parentId', 'anchor',
            'anchorValue', 'growth', 'growthValue', 'lane', 'laneValue'
          ] as const)
        }),
        fields: Object.freeze({
          kind: Object.freeze({
            enum: 'model.moduleKinds'
          }),
          cardinality: Object.freeze({
            requiredByKind: Object.freeze({
              core: false,
              mass: true,
              chain: true,
              limb: true,
              wheel: true,
              radial: true
            }),
            fixedByKind: Object.freeze({
              core: 'single',
              mass: 'single',
              chain: 'single',
              limb: 'paired',
              wheel: 'paired',
              radial: 'single'
            }),
            enum: 'model.cardinalities'
          }),
          anchor: Object.freeze({
            enum: 'anchors'
          }),
          growth: Object.freeze({
            enum: 'growth'
          }),
          lane: Object.freeze({
            enum: 'lanes'
          })
        })
      }),
      surface: Object.freeze({
        cardinality: Object.freeze({ min: 0, max: null }),
        sourceTokens: Object.freeze([
          'surface', 'id', 'cardinality', 'role', 'parent', 'parentId',
          'anchor', 'anchorValue', 'growth', 'growthValue', 'lane',
          'laneValue'
        ] as const),
        fields: Object.freeze({
          role: Object.freeze({
            enum: 'model.surfaceRoles'
          }),
          cardinality: Object.freeze({
            enum: 'model.cardinalities'
          }),
          anchor: Object.freeze({
            enum: 'anchors'
          }),
          growth: Object.freeze({
            enum: 'growth'
          }),
          lane: Object.freeze({
            enum: 'lanes'
          })
        })
      }),
      shape: Object.freeze({
        cardinality: Object.freeze({ min: 0, max: 1, per: 'surface' }),
        sourceHeader: Object.freeze(['shape', 'surfaceId'] as const),
        fields: Object.freeze({
          axis: Object.freeze({
            required: true, cardinality: 1, enum: 'surfaceShapes.axis'
          }),
          span: Object.freeze({
            required: true, cardinality: 1, enum: 'surfaceShapes.span'
          }),
          chord: Object.freeze({
            required: true, cardinality: 1, enum: 'surfaceShapes.chord'
          }),
          tip: Object.freeze({
            required: true, cardinality: 1, enum: 'surfaceShapes.tip'
          }),
          offset: Object.freeze({
            required: true, cardinality: 1, enum: 'surfaceShapes.offset'
          }),
          edge: Object.freeze({
            required: true, cardinality: 1, enum: 'surfaceShapes.edge'
          })
        })
      }),
      face: Object.freeze({
        cardinality: 1,
        sourceHeader: Object.freeze(['face'] as const),
        sourceTokensByProperty: Object.freeze({
          none: Object.freeze(['none'] as const),
          full: Object.freeze(['full', 'parent', 'parentId'] as const),
          eyes: Object.freeze([
            'eyes', 'configuration', 'gaze', 'gazeMode'
          ] as const),
          nose: Object.freeze(['nose', 'mode'] as const),
          mouth: Object.freeze(['mouth', 'mode'] as const)
        }),
        fields: Object.freeze({
          kind: Object.freeze({
            enum: 'model.faceKinds'
          }),
          parent: Object.freeze({
            required: 'full'
          }),
          eyes: Object.freeze({
            required: 'full', cardinality: 1,
            enum: 'model.eyeConfigurations'
          }),
          gaze: Object.freeze({
            required: 'full', cardinality: 1, enum: 'model.gazeModes'
          }),
          nose: Object.freeze({
            required: 'full', cardinality: 1, enum: 'model.noseModes'
          }),
          mouth: Object.freeze({
            required: 'full', cardinality: 1, enum: 'model.mouthModes'
          })
        })
      }),
      focal: Object.freeze({
        cardinality: Object.freeze({ min: 0, max: 1 }),
        sourceTokens: Object.freeze([
          'focal', 'id', 'parent', 'parentId'
        ] as const)
      })
    }),
    animation: Object.freeze({
      idle: Object.freeze({
        cardinality: 1,
        sourceTokensByTarget: Object.freeze({
          absent: Object.freeze(['idle', 'mode'] as const),
          present: Object.freeze([
            'idle', 'mode', 'target', 'targetId'
          ] as const)
        }),
        fields: Object.freeze({
          mode: Object.freeze({
            enum: 'animation.idleModes'
          })
        })
      })
    }),
    appearance: Object.freeze({
      palette: Object.freeze({
        enum: 'appearance.palettes',
        cardinality: 1,
        sourceTokens: Object.freeze(['palette', 'value'] as const)
      }),
      texture: Object.freeze({
        schema: PROJECT_APPEARANCE_SPECIFICATION.statements.texture
      }),
      seed: Object.freeze({
        schema: PROJECT_APPEARANCE_SPECIFICATION.statements.seed
      }),
      mark: Object.freeze({
        schema: PROJECT_APPEARANCE_SPECIFICATION.statements.mark
      })
    })
  })
});

export type IntentLanguageSpecification =
  typeof INTENT_PROGRAM_LANGUAGE_SPECIFICATION;
