import type { ExportCompatibilityEntry } from './registry';

export type ExportPreset = ExportCompatibilityEntry['target'];

export type MinecraftGameVersion = Exclude<
  ExportCompatibilityEntry['gameVersion'],
  null
>;

export type JavaGameVersion = Extract<
  ExportCompatibilityEntry,
  { target: 'java_block' }
>['gameVersion'];

export type AnimationExportSupport = 'none' | 'actor' | 'scene';

export interface ExportCompatibilityOption {
  target: ExportPreset;
  label: string;
  gameVersion: MinecraftGameVersion | null;
  gameVersionLabel: string | null;
  isDefaultVersion: boolean;
  animationSupport: AnimationExportSupport;
}
