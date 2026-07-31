import type { InvariantFinding } from '../validation';

export type ProductionReadinessCode =
  | 'production.geometry_missing'
  | 'production.texture_coverage_incomplete'
  | 'production.idle_missing'
  | 'production.idle_channels_missing'
  | 'production.idle_loop_invalid'
  | 'production.animation_loop_invalid'
  | 'production.animation_preview_unfaithful'
  | 'production.animation_export_unsupported'
  | 'production.intent_missing'
  | 'production.intent_invalid'
  | 'production.intent_grounding_mismatch'
  | 'production.intent_grounding_unstable'
  | 'production.intent_grounding_unverifiable'
  | 'production.intent_evaluation_unavailable';

export interface ProductionReadinessFinding {
  code: ProductionReadinessCode;
  severity: 'error';
  message: string;
  path: string;
  entityIds?: readonly string[];
  assetIds?: readonly string[];
  clipIds?: readonly string[];
  idsTruncated?: boolean;
  fix: string;
}

export interface ProductionReadinessCounts {
  structuralErrors: number;
  structuralWarnings: number;
  visibleGeometry: number;
  enabledVisibleFaces: number;
  texturedVisibleFaces: number;
  untexturedVisibleFaces: number;
  idleClips: number;
  idleChannels: number;
  animationClips: number;
  previewableAnimationClips: number;
  exportableAnimationClips: number;
  intentPresent: boolean;
  features: number;
  unverifiableGeometry: number;
  groundSupportCells: number;
  projectedFootprintCells: number;
  uniformCenterOfMassSupported: boolean | null;
}

export interface ProductionReadinessReport {
  structurallyValid: boolean;
  mechanicallyReady: boolean;
  semanticReviewRequired: true;
  counts: ProductionReadinessCounts;
  findings: readonly ProductionReadinessFinding[];
  firstBlockingFinding:
    | InvariantFinding
    | ProductionReadinessFinding
    | null;
}
