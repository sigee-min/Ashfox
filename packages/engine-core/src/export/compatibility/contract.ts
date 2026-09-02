import type { ExportCompatibilityEntry } from './registry';

export type ExportPreset = ExportCompatibilityEntry['target'];

export type AnimationExportSupport = 'none' | 'actor' | 'scene';

export interface ExportCompatibilityOption {
  target: ExportPreset;
  label: string;
  targetVersion: string;
  namespaceRequired: boolean;
  animationSupport: AnimationExportSupport;
}
