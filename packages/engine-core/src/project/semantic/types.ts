export type ProjectSubjectDomain = 'organism' | 'constructed';

export type ProjectCanonicalSupport =
  | { kind: 'standing-feet' }
  | { kind: 'rolling-wheels' }
  | { kind: 'supported-base' }
  | { kind: 'none' }
  | {
      kind: 'free-explicit';
      /** Reference observations explicitly justifying an ungrounded asset. */
      referenceIds: readonly string[];
    };

export type ProjectSemanticFace =
  | { kind: 'none' }
  | {
      kind: 'full';
      eyeConfiguration: 'single' | 'paired';
      nasal: 'present' | 'absent';
      oral: 'present' | 'absent';
    };

export type ProjectSupportedSurfaceRole =
  | 'wing'
  | 'fin'
  | 'sail'
  | 'panel';

export type ProjectSupportedSurfaceAnchor =
  | 'front'
  | 'rear'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'sides';

export type ProjectSupportedSurfaceGrowth =
  | 'forward'
  | 'rearward'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'outward';

export interface ProjectSupportedSurfaceObligation {
  /** Stable semantic ID realized exactly by authoring span slots. */
  id: string;
  role: ProjectSupportedSurfaceRole;
  cardinality: 'paired' | 'single';
  anchor: ProjectSupportedSurfaceAnchor;
  growth: ProjectSupportedSurfaceGrowth;
}

/** Closed machine authority that an AuthoringProfile must realize exactly. */
export interface ProjectSemanticContract {
  subjectDomain: ProjectSubjectDomain;
  canonicalSupport: ProjectCanonicalSupport;
  face: ProjectSemanticFace;
  supportedSurfaces: readonly ProjectSupportedSurfaceObligation[];
}
