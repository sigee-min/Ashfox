import type { ExportFormatProfile } from '../adapterTypes';
import { exportCompatibilityFor } from './queries';
import type {
  ExportPreset,
  MinecraftGameVersion
} from './types';

export const exportProfileForAdapter = (
  target: ExportPreset,
  gameVersion: MinecraftGameVersion | undefined,
  namespace: string,
  modelPath: string
): ExportFormatProfile | null => {
  const compatibility = exportCompatibilityFor(target, gameVersion);
  if (!compatibility) return null;

  switch (compatibility.target) {
    case 'gltf':
    case 'glb':
      return {
        ...compatibility.profile,
        modelPath
      };
    case 'java_block':
      return {
        ...compatibility.profile,
        namespace,
        modelPath
      };
    case 'bedrock':
      return {
        ...compatibility.profile,
        namespace,
        modelPath,
        animationPath: modelPath,
        geometryIdentifier:
          `geometry.${modelPath.split('/').join('.')}`
      };
    case 'geckolib5':
      return {
        ...compatibility.profile,
        namespace,
        modelPath,
        animationPath: modelPath,
        geometryIdentifier:
          `geometry.${modelPath.split('/').join('.')}`
      };
  }
};
