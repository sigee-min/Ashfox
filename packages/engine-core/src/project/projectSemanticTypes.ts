export type ProjectSubjectDomain = 'organism' | 'constructed';

export type ProjectCanonicalSupport =
  | { kind: 'standing-feet' }
  | { kind: 'supported-base' }
  | { kind: 'airborne' }
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

export type ProjectSupportedSurfaceExtension =
  | 'lateral'
  | 'up'
  | 'forward'
  | 'rearward';

export interface ProjectSupportedSurfaceObligation {
  /** Stable semantic ID realized exactly by authoring span slots. */
  id: string;
  role: ProjectSupportedSurfaceRole;
  configuration: 'paired' | 'single';
  extension: ProjectSupportedSurfaceExtension;
}

/** Closed machine authority that an AuthoringProfile must realize exactly. */
export interface ProjectSemanticContract {
  subjectDomain: ProjectSubjectDomain;
  canonicalSupport: ProjectCanonicalSupport;
  face: ProjectSemanticFace;
  supportedSurfaces: readonly ProjectSupportedSurfaceObligation[];
}
