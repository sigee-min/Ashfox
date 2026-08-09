import type { Vec3 } from '../../model';

/**
 * Target-specific shape used only while an already-compiled project is
 * delivered to an external runtime. It is never persisted in a project.
 */
export interface GenericExportProfile {
  id: 'ashfox.generic';
  version: '1';
}

export interface MinecraftJavaBlockExportProfile {
  id: 'minecraft.java_block';
  minecraftVersion: '1.21.5' | '1.21.11' | '26.1' | '26.2';
  resourcePackFormat: 55 | 75 | 84 | 88;
  namespace: string;
  modelPath: string;
  modelKind: 'block';
  parent?: string;
  ambientOcclusion?: boolean;
  guiLight?: 'front' | 'side';
}

export interface MinecraftBedrockExportProfile {
  id: 'minecraft.bedrock';
  minecraftVersion: '1.21.130' | '1.26.0' | '1.26.30';
  geometryFormatVersion: '1.21.0';
  animationFormatVersion: '1.8.0';
  namespace: string;
  modelPath: string;
  animationPath: string;
  geometryKind: 'entity' | 'block';
  geometryIdentifier: string;
  visibleBounds?: {
    width: number;
    height: number;
    offset: Vec3;
  };
}

export interface MinecraftJavaGeckoLib5ExportProfile {
  id: 'minecraft.java.geckolib5';
  version: '5';
  minecraftVersion: '1.21.5' | '1.21.11' | '26.1';
  geometryFormatVersion: '1.12.0';
  animationFormatVersion: '1.8.0';
  namespace: string;
  assetKind: 'entity' | 'block' | 'item';
  modelPath: string;
  animationPath: string;
  geometryIdentifier: string;
  visibleBounds?: {
    width: number;
    height: number;
    offset: Vec3;
  };
}

export interface Gltf2ExportProfile {
  id: 'gltf.2';
  version: '2.0';
  container: 'gltf' | 'glb';
  imageStorage: 'external' | 'embedded';
  modelPath: string;
  copyright?: string;
}

export type ExportFormatProfile =
  | GenericExportProfile
  | MinecraftJavaBlockExportProfile
  | MinecraftBedrockExportProfile
  | MinecraftJavaGeckoLib5ExportProfile
  | Gltf2ExportProfile;

/** A transient Minecraft resource binding derived immediately for delivery. */
export interface MinecraftTextureBinding {
  key: string;
  resource: MinecraftResourceLocation;
  extension: 'png';
  particle?: boolean;
}

export interface MinecraftResourceLocation {
  namespace: string;
  path: string;
}
