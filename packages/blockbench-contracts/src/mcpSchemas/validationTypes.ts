export type ValidationReason =
  | 'type'
  | 'enum'
  | 'minItems'
  | 'maxItems'
  | 'minimum'
  | 'maximum'
  | 'pattern'
  | 'minProperties'
  | 'required'
  | 'additionalProperties'
  | 'anyOf';

export type ValidationResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      path: string;
      reason: ValidationReason;
      details?: Record<string, unknown>;
    };
