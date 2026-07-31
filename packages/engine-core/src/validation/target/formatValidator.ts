import type { ProjectDocument } from '../../model';
import { validateExportCompatibilityProfile } from '../../export/compatibilityValidation';
import type { FindingSink } from '../types';
import { validateAnimationExportCapabilities } from './animationExportValidator';
import { validateGltfProfile } from './gltfValidator';
import { validateJavaBlockProfile } from './javaBlockValidator';
import { validateMinecraftActorProfile } from './minecraftActorValidator';

export const validateFormatProfile = (
  document: ProjectDocument,
  add: FindingSink
): void => {
  validateExportCompatibilityProfile(document).forEach(add);
  validateJavaBlockProfile(document, add);
  validateMinecraftActorProfile(document, add);
  validateGltfProfile(document, add);
  validateAnimationExportCapabilities(document, add);
};
