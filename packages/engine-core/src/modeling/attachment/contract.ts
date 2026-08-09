import type { PartSpec } from '../part';
import type { PartAttachmentReflectionPlan } from './reflect';

export interface PartAttachmentDerivationFailure {
  ok: false;
  path: string;
  message: string;
}

export interface PartAttachmentDerivationSuccess {
  ok: true;
  parts: readonly PartSpec[];
}

export type PartAttachmentDerivationResult =
  | PartAttachmentDerivationFailure
  | PartAttachmentDerivationSuccess;

export interface PartAttachmentDerivationOptions {
  reflection?: PartAttachmentReflectionPlan;
}

export interface PartParentInferenceFailure {
  ok: false;
  partId: string;
  message: string;
}

export interface PartParentInferenceSuccess {
  ok: true;
  parts: readonly PartSpec[];
}

export type PartParentInferenceResult =
  | PartParentInferenceFailure
  | PartParentInferenceSuccess;
