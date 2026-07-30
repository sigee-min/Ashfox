import type { ProjectDocument } from '../model';
import {
  validateCommandInput,
  type CommandInputSchema,
  type SchemaIssue
} from './schema';
import type {
  CommandEffects,
  CommandError,
  CommandName,
  CommandPayloadMap
} from './types';

export interface CommandApplicationError extends CommandError {
  pathScope?: 'operation' | 'document';
}

export interface CommandApplication {
  document: ProjectDocument;
  summary: string;
  effects: CommandEffects;
}

export type CommandApplicationResult =
  | {
      ok: true;
      value: CommandApplication;
    }
  | {
      ok: false;
      error: CommandApplicationError;
    };

export interface CommandDefinition {
  name: CommandName;
  label: string;
  purpose: string;
  inputSchema: CommandInputSchema;
  validate: (payload: unknown) => SchemaIssue | null;
  apply: (
    document: ProjectDocument,
    payload: unknown
  ) => CommandApplicationResult;
}

interface CommandDefinitionSpec<TName extends CommandName> {
  name: TName;
  label: string;
  purpose: string;
  inputSchema: CommandInputSchema;
  apply: (
    document: ProjectDocument,
    payload: CommandPayloadMap[TName]
  ) => CommandApplicationResult;
}

export const defineCommand = <TName extends CommandName>(
  spec: CommandDefinitionSpec<TName>
): CommandDefinition => {
  const validate = (payload: unknown): SchemaIssue | null =>
    validateCommandInput(payload, spec.inputSchema);

  return {
    name: spec.name,
    label: spec.label,
    purpose: spec.purpose,
    inputSchema: spec.inputSchema,
    validate,
    apply: (document, payload) => {
      const issue = validate(payload);
      if (issue) {
        return {
          ok: false,
          error: {
            code: 'invalid_payload',
            message: issue.message,
            path: issue.path,
            expected: issue.expected
          }
        };
      }
      return spec.apply(document, payload as CommandPayloadMap[TName]);
    }
  };
};
