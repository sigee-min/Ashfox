import { validateAnimations } from '../animation/validate';
import { createValidationContext } from '../context';
import { validateProjectDocumentContract } from '../document/contract';
import { validateSceneOcclusion } from '../scene/occlusion';
import { validateScene } from '../scene/validate';
import { validateTextures } from '../texture/validate';
import { validateDocument } from './authority';
import { validateModelParts } from './model';
import type {
  ValidationReport
} from '../contract';
import {
  DEFAULT_INTENT_VALIDATION_COMPUTATION,
  type IntentProgramValidationAttestation,
  type IntentProgramValidationComputation
} from './candidate';

const sortedByPathAndCode = (
  findings: ValidationReport['findings']
): ValidationReport['findings'] =>
  [...findings].sort((left, right) => {
    const pathOrder = left.path.localeCompare(right.path);
    if (pathOrder !== 0) return pathOrder;
    return left.code.localeCompare(right.code);
  });

const validateProjectDocumentWithCandidate = (
  value: unknown,
  attestation: IntentProgramValidationAttestation | undefined,
  computation: IntentProgramValidationComputation
): ValidationReport => {
  const context = createValidationContext();
  if (validateProjectDocumentContract(value, context.add)) {
    validateDocument(value, context.add, attestation, computation);
    validateScene(value, context.add, context.registerId);
    validateModelParts(value, context.add);
    validateSceneOcclusion(value, context.add);
    validateTextures(value, context.add, context.registerId);
    validateAnimations(value, context.add, context.registerId);
  }

  const findings = sortedByPathAndCode(context.findings);
  return {
    valid: !findings.some((finding) => finding.severity === 'error'),
    findings
  };
};

/** Public/raw validation always recomputes source-owned compiler evidence. */
export const validateProjectDocument = (
  value: unknown
): ValidationReport => validateProjectDocumentWithCandidate(
  value,
  undefined,
  DEFAULT_INTENT_VALIDATION_COMPUTATION
);

/** Internal command boundary for one exact, ephemeral candidate reference. */
export const validateProjectDocumentCandidate = (
  value: unknown,
  attestation: IntentProgramValidationAttestation,
  computation: IntentProgramValidationComputation =
    DEFAULT_INTENT_VALIDATION_COMPUTATION
): ValidationReport => validateProjectDocumentWithCandidate(
  value,
  attestation,
  computation
);
