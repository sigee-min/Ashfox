import { PROJECT_APPEARANCE_SPECIFICATION } from '../contract';
import type { IntentProgramToken } from '../../program/lexer';
import type { IntentProgramSpan } from '../../program/types';
import {
  identifierPattern,
  isIntentProgramVocabularyWord,
  isIntentProgramWord,
  isIntentProgramWordToken,
  type IntentProgramWordToken
} from '../../program/syntax';

export const appearanceVocabularies = Object.freeze({
  textures: PROJECT_APPEARANCE_SPECIFICATION.textures,
  targets: PROJECT_APPEARANCE_SPECIFICATION.targets,
  regions: PROJECT_APPEARANCE_SPECIFICATION.regions,
  placements: PROJECT_APPEARANCE_SPECIFICATION.placements,
  motifs: PROJECT_APPEARANCE_SPECIFICATION.motifs,
  tones: PROJECT_APPEARANCE_SPECIFICATION.tones,
  flows: PROJECT_APPEARANCE_SPECIFICATION.flows,
  scales: PROJECT_APPEARANCE_SPECIFICATION.scales,
  densities: PROJECT_APPEARANCE_SPECIFICATION.densities,
  contrasts: PROJECT_APPEARANCE_SPECIFICATION.contrasts
});

export interface AppearanceSourceReporter {
  error(code: string, message: string, token: IntentProgramToken): void;
  field(path: string, value: string, span: IntentProgramSpan): void;
}

export class AppearanceLineCursor {
  private index = 0;
  private failed = false;

  constructor(
    private readonly values: readonly IntentProgramToken[],
    private readonly fallback: IntentProgramToken,
    private readonly reporter: AppearanceSourceReporter,
    private readonly code: string
  ) {}

  get valid(): boolean {
    return !this.failed;
  }

  private reject(code: string, message: string, token?: IntentProgramToken): void {
    this.failed = true;
    this.reporter.error(code, message, token ?? this.fallback);
    if (token) this.index += 1;
  }

  word<TValue extends string>(
    value: TValue
  ): IntentProgramWordToken<TValue> | null {
    const token = this.values[this.index];
    if (!isIntentProgramWord(token, value)) {
      this.reject(this.code, `Expected "${value}".`, token);
      return null;
    }
    this.index += 1;
    return token;
  }

  vocabulary<TValue extends string>(
    values: readonly TValue[],
    label: string
  ): IntentProgramWordToken<TValue> | null {
    const token = this.values[this.index];
    if (!isIntentProgramVocabularyWord(token, values)) {
      this.reject(
        this.code,
        `Expected ${label} to be one of: ${values.join(', ')}.`,
        token
      );
      return null;
    }
    this.index += 1;
    return token;
  }

  identifier(label: string): IntentProgramWordToken | null {
    const token = this.values[this.index];
    if (!isIntentProgramWordToken(token) || !identifierPattern.test(token.value)) {
      this.reject(
        'intent.invalid_identifier',
        `${label} must be lower-kebab-case (for example, "pale-belly").`,
        token
      );
      return null;
    }
    this.index += 1;
    return token;
  }

  has(value: string): boolean {
    return isIntentProgramWord(this.values[this.index], value);
  }

  complete(): boolean {
    while (this.values[this.index]) {
      const token = this.values[this.index]!;
      this.reject(
        this.code,
        `Unexpected appearance value "${token.value}".`,
        token
      );
    }
    return this.valid;
  }
}
