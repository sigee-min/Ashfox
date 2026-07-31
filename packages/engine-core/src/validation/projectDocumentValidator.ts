import type { ProjectDocument } from '../model';
import { validateAnimations } from './animation/animationValidator';
import { createValidationContext } from './context';
import { validateDocument } from './documentValidator';
import { validateModelParts } from './modelPartsValidator';
import { validateSceneOcclusion } from './scene/occlusionValidator';
import { validateScene } from './scene/sceneValidator';
import { validateFormatProfile } from './target/formatValidator';
import { validateTextures } from './textureValidator';
import type {
  ValidateProjectOptions,
  ValidationReport
} from './types';

const sortedByPathAndCode = (
  findings: ValidationReport['findings']
): ValidationReport['findings'] =>
  [...findings].sort((left, right) => {
    const pathOrder = left.path.localeCompare(right.path);
    if (pathOrder !== 0) return pathOrder;
    return left.code.localeCompare(right.code);
  });

export const validateProjectDocument = (
  document: ProjectDocument,
  options: ValidateProjectOptions = {}
): ValidationReport => {
  const context = createValidationContext();
  validateDocument(document, context.add);
  validateScene(document, context.add, context.registerId);
  validateModelParts(document, context.add);
  validateSceneOcclusion(document, context.add);
  validateTextures(document, context.add, context.registerId);
  validateAnimations(document, context.add, context.registerId);
  if (options.includeFormatProfile !== false) {
    validateFormatProfile(document, context.add);
  }

  const findings = sortedByPathAndCode(context.findings);
  return {
    valid: !findings.some((finding) => finding.severity === 'error'),
    findings
  };
};
