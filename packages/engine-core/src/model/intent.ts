import type { ProjectAppearanceBinding, ProjectAppearanceV1 } from '../project/appearance/contract';
import type {
  PROJECT_FORWARD_DIRECTIONS,
  PROJECT_GROUNDING_VALUES,
  PROJECT_REFERENCE_KINDS
} from '../project/intent/contract';
import type { ProjectSemanticContract } from '../project/semantic/types';

export type ProjectForwardDirection =
  (typeof PROJECT_FORWARD_DIRECTIONS)[number];

export type ProjectSymmetry =
  | {
      kind: 'bilateral';
      /** Twice the bilateral reflection-plane coordinate on the lattice. */
      planeTwice: number;
    }
  | {
      kind: 'asymmetric';
      /** Local reflection authority for explicitly paired modules. */
      pairPlaneTwice?: number;
    };

export type ProjectGrounding =
  (typeof PROJECT_GROUNDING_VALUES)[number];

export type ProjectReferenceKind =
  (typeof PROJECT_REFERENCE_KINDS)[number];

export interface ProjectReferenceObservation {
  id: string;
  kind: ProjectReferenceKind;
  description: string;
  cues: readonly string[];
  contentHash?: string;
}

export interface ProjectIntent {
  subject: string;
  forward: ProjectForwardDirection;
  grounding: ProjectGrounding;
  symmetry: ProjectSymmetry;
  semanticContract: ProjectSemanticContract;
  /** Human/agent review criteria. Their meaning is not machine-validated. */
  features: readonly string[];
  /** Auditable observations used to route and review authoring authorities. */
  references?: readonly ProjectReferenceObservation[];
  readonly appearance?: ProjectAppearanceV1;
  readonly appearanceBindings?: readonly ProjectAppearanceBinding[];
}
