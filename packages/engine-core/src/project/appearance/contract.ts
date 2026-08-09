import { PROJECT_SEMANTIC_IDENTIFIER_PATTERN } from '../identifier';

/** Closed, coordinate-free Surface Appearance vocabulary persisted in intent. */
export const PROJECT_APPEARANCE_SPECIFICATION = Object.freeze({
  version: 1,
  /** Hard ceiling that bounds pairwise overlap validation. */
  maxMarkings: 32,
  maxSeedLength: 64,
  textures: Object.freeze([
    'quiet', 'mottle', 'grain', 'brushed', 'weathered'
  ] as const),
  targets: Object.freeze(['body', 'surface', 'face', 'focal'] as const),
  regions: Object.freeze([
    'full', 'dorsal', 'ventral', 'flank', 'anterior', 'posterior',
    'dorsal-flank', 'ventral-flank', 'anterior-flank',
    'posterior-flank'
  ] as const),
  placements: Object.freeze([
    'whole', 'center', 'root', 'tip', 'joint', 'edge'
  ] as const),
  motifs: Object.freeze([
    'wash', 'band', 'stripe', 'bars', 'spots', 'patch', 'rim'
  ] as const),
  tones: Object.freeze(['lighter', 'darker', 'accent'] as const),
  flows: Object.freeze([
    'longitudinal', 'vertical', 'transverse', 'radial'
  ] as const),
  scales: Object.freeze(['fine', 'medium', 'broad'] as const),
  densities: Object.freeze(['sparse', 'balanced', 'rich'] as const),
  contrasts: Object.freeze(['subtle', 'medium', 'bold'] as const),
  statements: Object.freeze({
    texture: Object.freeze({
      keyword: 'texture',
      cardinality: 'exactly-one',
      order: Object.freeze([
        'kind', 'scale', 'density', 'contrast'
      ] as const),
      markers: Object.freeze({
        scale: 'scale',
        density: 'density',
        contrast: 'contrast'
      } as const),
      values: Object.freeze({
        kind: 'textures',
        scale: 'scales',
        density: 'densities',
        contrast: 'contrasts'
      } as const)
    }),
    seed: Object.freeze({
      keyword: 'seed',
      cardinality: 'exactly-one',
      order: Object.freeze(['value'] as const),
      forms: Object.freeze({
        automatic: Object.freeze({
          kind: 'auto',
          sentinel: 'auto',
          properties: Object.freeze(['kind'] as const)
        }),
        explicit: Object.freeze({
          kind: 'explicit',
          properties: Object.freeze(['kind', 'value'] as const),
          value: Object.freeze({
            format: 'lower-kebab-case',
            pattern: PROJECT_SEMANTIC_IDENTIFIER_PATTERN.source,
            maxLength: 'maxSeedLength'
          } as const)
        })
      })
    }),
    mark: Object.freeze({
      keyword: 'mark',
      cardinality: Object.freeze({
        minimum: 0,
        maximum: 'maxMarkings'
      } as const),
      identity: Object.freeze({ field: 'id', unique: true } as const),
      optional: Object.freeze(['flow', 'variant'] as const),
      order: Object.freeze([
        'id', 'target', 'region', 'placement', 'motif', 'tone', 'flow',
        'variant', 'scale', 'density', 'contrast'
      ] as const),
      markers: Object.freeze({
        target: 'target',
        region: 'region',
        placement: 'placement',
        motif: 'as',
        tone: 'tone',
        flow: 'flow',
        variant: 'variant',
        scale: 'scale',
        density: 'density',
        contrast: 'contrast'
      } as const),
      values: Object.freeze({
        target: 'targets',
        region: 'regions',
        placement: 'placements',
        motif: 'motifs',
        tone: 'tones',
        flow: 'flows',
        scale: 'scales',
        density: 'densities',
        contrast: 'contrasts'
      } as const),
      targetReferences: Object.freeze({
        body: Object.freeze({ namespace: 'body', idCardinality: 1 } as const),
        surface: Object.freeze({
          namespace: 'surfaces', idCardinality: 1
        } as const),
        face: Object.freeze({ namespace: 'face', idCardinality: 0 } as const),
        focal: Object.freeze({ namespace: 'focal', idCardinality: 1 } as const)
      }),
      conditions: Object.freeze({
        flow: Object.freeze({
          allowedWhen: Object.freeze({
            motif: Object.freeze(['band', 'stripe', 'bars'] as const)
          }),
          forbiddenOtherwise: true,
          values: 'motifFlows'
        } as const)
      })
    })
  }),
  capabilities: Object.freeze({
    body: Object.freeze({
      regions: Object.freeze([
        'full', 'dorsal', 'ventral', 'flank', 'anterior', 'posterior',
        'dorsal-flank', 'ventral-flank', 'anterior-flank',
        'posterior-flank'
      ] as const),
      placements: Object.freeze([
        'whole', 'center', 'root', 'tip', 'joint', 'edge'
      ] as const)
    }),
    surface: Object.freeze({
      regions: Object.freeze([
        'full', 'dorsal', 'ventral', 'flank', 'anterior', 'posterior',
        'dorsal-flank', 'ventral-flank', 'anterior-flank',
        'posterior-flank'
      ] as const),
      placements: Object.freeze([
        'whole', 'center', 'root', 'tip', 'edge'
      ] as const)
    }),
    face: Object.freeze({
      regions: Object.freeze([
        'full', 'dorsal', 'ventral', 'flank',
        'dorsal-flank', 'ventral-flank'
      ] as const),
      placements: Object.freeze(['whole', 'center', 'edge'] as const)
    }),
    focal: Object.freeze({
      regions: Object.freeze([
        'full', 'dorsal', 'ventral', 'flank', 'anterior', 'posterior',
        'dorsal-flank', 'ventral-flank', 'anterior-flank',
        'posterior-flank'
      ] as const),
      placements: Object.freeze([
        'whole', 'center', 'root', 'tip', 'edge'
      ] as const)
    })
  }),
  motifFlows: Object.freeze({
    wash: Object.freeze([] as const),
    band: Object.freeze([
      'longitudinal', 'vertical', 'transverse', 'radial'
    ] as const),
    stripe: Object.freeze([
      'longitudinal', 'vertical', 'transverse', 'radial'
    ] as const),
    bars: Object.freeze([
      'longitudinal', 'vertical', 'transverse', 'radial'
    ] as const),
    spots: Object.freeze([] as const),
    patch: Object.freeze([] as const),
    rim: Object.freeze([] as const)
  }),
  motifClasses: Object.freeze({
    wash: 'wash',
    band: 'band',
    stripe: 'line',
    bars: 'line',
    spots: 'island',
    patch: 'island',
    rim: 'island'
  } as const),
  markingOverlap: Object.freeze({
    regionAxes: Object.freeze({
      full: Object.freeze([] as const),
      dorsal: Object.freeze(['dorsal'] as const),
      ventral: Object.freeze(['ventral'] as const),
      flank: Object.freeze(['flank'] as const),
      anterior: Object.freeze(['anterior'] as const),
      posterior: Object.freeze(['posterior'] as const),
      'dorsal-flank': Object.freeze(['dorsal', 'flank'] as const),
      'ventral-flank': Object.freeze(['ventral', 'flank'] as const),
      'anterior-flank': Object.freeze(['anterior', 'flank'] as const),
      'posterior-flank': Object.freeze(['posterior', 'flank'] as const)
    }),
    oppositeRegionAxes: Object.freeze({
      dorsal: 'ventral',
      ventral: 'dorsal',
      anterior: 'posterior',
      posterior: 'anterior'
    } as const),
    overlappingPlacements: Object.freeze({
      whole: Object.freeze([
        'whole', 'center', 'root', 'tip', 'joint', 'edge'
      ] as const),
      center: Object.freeze(['whole', 'center'] as const),
      root: Object.freeze(['whole', 'root', 'joint'] as const),
      tip: Object.freeze(['whole', 'tip', 'edge'] as const),
      joint: Object.freeze(['whole', 'joint', 'root'] as const),
      edge: Object.freeze(['whole', 'edge', 'tip'] as const)
    })
  })
});

export type ProjectAppearanceTextureKind =
  (typeof PROJECT_APPEARANCE_SPECIFICATION.textures)[number];
export type ProjectAppearanceTargetKind =
  (typeof PROJECT_APPEARANCE_SPECIFICATION.targets)[number];
export type ProjectAppearanceRegion =
  (typeof PROJECT_APPEARANCE_SPECIFICATION.regions)[number];
export type ProjectAppearancePlacement =
  (typeof PROJECT_APPEARANCE_SPECIFICATION.placements)[number];
export type ProjectAppearanceMotif =
  (typeof PROJECT_APPEARANCE_SPECIFICATION.motifs)[number];
export type ProjectAppearanceTone =
  (typeof PROJECT_APPEARANCE_SPECIFICATION.tones)[number];
export type ProjectAppearanceFlow =
  (typeof PROJECT_APPEARANCE_SPECIFICATION.flows)[number];
export type ProjectAppearanceScale =
  (typeof PROJECT_APPEARANCE_SPECIFICATION.scales)[number];
export type ProjectAppearanceDensity =
  (typeof PROJECT_APPEARANCE_SPECIFICATION.densities)[number];
export type ProjectAppearanceContrast =
  (typeof PROJECT_APPEARANCE_SPECIFICATION.contrasts)[number];

export type ProjectAppearanceSeed =
  | { readonly kind: 'auto' }
  | { readonly kind: 'explicit'; readonly value: string };

export interface ProjectAppearanceTexture {
  readonly kind: ProjectAppearanceTextureKind;
  readonly scale: ProjectAppearanceScale;
  readonly density: ProjectAppearanceDensity;
  readonly contrast: ProjectAppearanceContrast;
}

export type ProjectAppearanceTarget =
  | { readonly kind: 'face' }
  | {
      readonly kind: 'body' | 'surface' | 'focal';
      readonly id: string;
    };

export interface ProjectAppearanceMarking {
  readonly id: string;
  readonly target: ProjectAppearanceTarget;
  readonly region: ProjectAppearanceRegion;
  readonly placement: ProjectAppearancePlacement;
  readonly motif: ProjectAppearanceMotif;
  readonly tone: ProjectAppearanceTone;
  readonly flow?: ProjectAppearanceFlow;
  readonly variant?: string;
  readonly scale: ProjectAppearanceScale;
  readonly density: ProjectAppearanceDensity;
  /** Color distance only; excluded from every mask and seed projection. */
  readonly contrast: ProjectAppearanceContrast;
}

/** Normalized authored meaning. No lattice, UV, part, or scene identity leaks in. */
export interface ProjectAppearanceV1 {
  readonly version: 1;
  readonly seed: ProjectAppearanceSeed;
  readonly texture: ProjectAppearanceTexture;
  readonly markings: readonly ProjectAppearanceMarking[];
}

/** Compiler-owned realization of one semantic target against generated parts. */
export interface ProjectAppearanceBinding {
  readonly markingId: string;
  readonly partIds: readonly string[];
  readonly faceScope: 'full' | 'anterior';
  /** Compiler palette projection; excluded from every role-mask input. */
  readonly accentColor?: string;
}
