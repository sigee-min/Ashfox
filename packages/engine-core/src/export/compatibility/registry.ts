export const EXPORT_COMPATIBILITY_REGISTRY = [
  {
    target: 'geckolib5',
    label: 'GeckoLib 5',
    gameVersion: '1.21.5',
    gameVersionLabel: 'Java 1.21.5',
    isDefaultVersion: false,
    animationSupport: 'actor',
    profile: {
      id: 'minecraft.java.geckolib5',
      version: '5',
      minecraftVersion: '1.21.5',
      geometryFormatVersion: '1.12.0',
      animationFormatVersion: '1.8.0',
      assetKind: 'entity'
    }
  },
  {
    target: 'geckolib5',
    label: 'GeckoLib 5',
    gameVersion: '1.21.11',
    gameVersionLabel: 'Java 1.21.11',
    isDefaultVersion: false,
    animationSupport: 'actor',
    profile: {
      id: 'minecraft.java.geckolib5',
      version: '5',
      minecraftVersion: '1.21.11',
      geometryFormatVersion: '1.12.0',
      animationFormatVersion: '1.8.0',
      assetKind: 'entity'
    }
  },
  {
    target: 'geckolib5',
    label: 'GeckoLib 5',
    gameVersion: '26.1',
    gameVersionLabel: 'Java 26.1',
    isDefaultVersion: true,
    animationSupport: 'actor',
    profile: {
      id: 'minecraft.java.geckolib5',
      version: '5',
      minecraftVersion: '26.1',
      geometryFormatVersion: '1.12.0',
      animationFormatVersion: '1.8.0',
      assetKind: 'entity'
    }
  },
  {
    target: 'java_block',
    label: 'Java block',
    gameVersion: '1.21.5',
    gameVersionLabel: 'Java 1.21.5',
    isDefaultVersion: false,
    animationSupport: 'none',
    supportsJavaBlockMultiAxisRotation: false,
    profile: {
      id: 'minecraft.java_block',
      minecraftVersion: '1.21.5',
      resourcePackFormat: 55,
      modelKind: 'block'
    }
  },
  {
    target: 'java_block',
    label: 'Java block',
    gameVersion: '1.21.11',
    gameVersionLabel: 'Java 1.21.11',
    isDefaultVersion: false,
    animationSupport: 'none',
    supportsJavaBlockMultiAxisRotation: true,
    profile: {
      id: 'minecraft.java_block',
      minecraftVersion: '1.21.11',
      resourcePackFormat: 75,
      modelKind: 'block'
    }
  },
  {
    target: 'java_block',
    label: 'Java block',
    gameVersion: '26.1',
    gameVersionLabel: 'Java 26.1',
    isDefaultVersion: false,
    animationSupport: 'none',
    supportsJavaBlockMultiAxisRotation: true,
    profile: {
      id: 'minecraft.java_block',
      minecraftVersion: '26.1',
      resourcePackFormat: 84,
      modelKind: 'block'
    }
  },
  {
    target: 'java_block',
    label: 'Java block',
    gameVersion: '26.2',
    gameVersionLabel: 'Java 26.2',
    isDefaultVersion: true,
    animationSupport: 'none',
    supportsJavaBlockMultiAxisRotation: true,
    profile: {
      id: 'minecraft.java_block',
      minecraftVersion: '26.2',
      resourcePackFormat: 88,
      modelKind: 'block'
    }
  },
  {
    target: 'bedrock',
    label: 'Bedrock geometry',
    gameVersion: '1.21.130',
    gameVersionLabel: 'Bedrock 1.21.130',
    isDefaultVersion: false,
    animationSupport: 'actor',
    profile: {
      id: 'minecraft.bedrock',
      minecraftVersion: '1.21.130',
      geometryFormatVersion: '1.21.0',
      animationFormatVersion: '1.8.0',
      geometryKind: 'entity'
    }
  },
  {
    target: 'bedrock',
    label: 'Bedrock geometry',
    gameVersion: '1.26.0',
    gameVersionLabel: 'Bedrock 1.26.0',
    isDefaultVersion: false,
    animationSupport: 'actor',
    profile: {
      id: 'minecraft.bedrock',
      minecraftVersion: '1.26.0',
      geometryFormatVersion: '1.21.0',
      animationFormatVersion: '1.8.0',
      geometryKind: 'entity'
    }
  },
  {
    target: 'bedrock',
    label: 'Bedrock geometry',
    gameVersion: '1.26.30',
    gameVersionLabel: 'Bedrock 1.26.30',
    isDefaultVersion: true,
    animationSupport: 'actor',
    profile: {
      id: 'minecraft.bedrock',
      minecraftVersion: '1.26.30',
      geometryFormatVersion: '1.21.0',
      animationFormatVersion: '1.8.0',
      geometryKind: 'entity'
    }
  },
  {
    target: 'glb',
    label: 'GLB',
    gameVersion: null,
    gameVersionLabel: null,
    isDefaultVersion: true,
    animationSupport: 'scene',
    profile: {
      id: 'gltf.2',
      version: '2.0',
      container: 'glb',
      imageStorage: 'embedded'
    }
  },
  {
    target: 'gltf',
    label: 'glTF',
    gameVersion: null,
    gameVersionLabel: null,
    isDefaultVersion: true,
    animationSupport: 'scene',
    profile: {
      id: 'gltf.2',
      version: '2.0',
      container: 'gltf',
      imageStorage: 'external'
    }
  }
] as const;

export type ExportCompatibilityEntry =
  (typeof EXPORT_COMPATIBILITY_REGISTRY)[number];
