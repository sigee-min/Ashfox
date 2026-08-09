import {
  DEFAULT_INTENT_VALIDATION_COMPUTATION,
  type IntentProgramValidationAttestation,
  type IntentProgramValidationComputation
} from '../../validation/project/candidate';

/** Mutable only within one synchronous command batch; never returned. */
export interface CommandExecutionContext {
  readonly computation: IntentProgramValidationComputation;
  validationAttestation?: IntentProgramValidationAttestation;
}

export const createCommandExecutionContext = (
  computation: IntentProgramValidationComputation =
    DEFAULT_INTENT_VALIDATION_COMPUTATION
): CommandExecutionContext => ({ computation });
