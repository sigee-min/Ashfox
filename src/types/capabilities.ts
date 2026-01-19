import { FormatKind } from './shared';

export interface Capability {
  format: FormatKind;
  animations: boolean;
  enabled: boolean;
}

export interface Limits {
  maxCubes: number;
  maxTextureSize: number;
  maxAnimationSeconds: number;
}

export interface PreviewCapability {
  pngOnly: boolean;
  fixedOutput: 'single';
  turntableOutput: 'sequence';
  response: 'dataUri' | 'content' | 'content+dataUri';
}

export interface CapabilitiesGuidance {
  toolPathStability: {
    cache: 'no' | 'yes';
    note: string;
  };
  mutationPolicy: {
    requiresRevision: boolean;
    note: string;
  };
  textureStrategy: {
    note: string;
  };
}

export interface Capabilities {
  pluginVersion: string;
  toolSchemaVersion?: string;
  blockbenchVersion: string;
  formats: Capability[];
  limits: Limits;
  preview?: PreviewCapability;
  guidance?: CapabilitiesGuidance;
}
