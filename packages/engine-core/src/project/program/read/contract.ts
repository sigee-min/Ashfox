import type { IntentProgramToken } from '../lexer';
import type { RawIntentProgram } from '../syntax';
import type { IntentProgramSpan } from '../types';

/** Reader-owned state and reporting ports shared by statement readers. */
export interface IntentProgramReadContext {
  readonly raw: RawIntentProgram;
  current(): IntentProgramToken;
  error(
    code: string,
    message: string,
    token?: IntentProgramToken
  ): void;
  identifier(
    token: IntentProgramToken | undefined,
    label: string,
    missingCode?: string
  ): string | null;
  /** Records both canonical source ownership and the active AST field. */
  field(path: string, value: string, origin: IntentProgramSpan): void;
  /** Records canonical source ownership without adding an implicit AST field. */
  span(path: string, origin: IntentProgramSpan): void;
}
