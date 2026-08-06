import { validateAnimations } from './animation/animationValidator';
import { createValidationContext } from './context';
import { validateDocument } from './documentValidator';
import { validateModelParts } from './modelPartsValidator';
import { validateProjectDocumentContract } from './projectDocumentContract';
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
  value: unknown,
  options: ValidateProjectOptions = {}
): ValidationReport => {
  const context = createValidationContext();
  if (validateProjectDocumentContract(value, context.add)) {
    validateDocument(value, context.add);
    validateScene(value, context.add, context.registerId);
    validateModelParts(value, context.add);
    validateSceneOcclusion(value, context.add);
    validateTextures(value, context.add, context.registerId);
    validateAnimations(value, context.add, context.registerId);
    if (options.includeFormatProfile !== false) {
      validateFormatProfile(value, context.add);
    }
  }

  const findings = sortedByPathAndCode(context.findings);
  return {
    valid: !findings.some((finding) => finding.severity === 'error'),
    findings
  };
};
