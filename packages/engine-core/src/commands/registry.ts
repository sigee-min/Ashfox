import type { CommandDefinition } from './definition';
import { createProjectCommand } from './definitions/createProject';
import {
  compileIntentProgramCommand
} from './program/compile';
import {
  proposeIntentProgramCommand
} from './program/propose';
import { renameProjectCommand } from './definitions/renameProject';
import type { CommandName, CommandSource } from './types';

/** The complete and sole Agent mutation authority. */
export const AGENT_ACCESSIBLE_COMMAND_NAMES = Object.freeze([
  'intent.program.compile',
  'intent.program.propose'
] as const);
const agentAccessibleCommandNames = new Set<string>(
  AGENT_ACCESSIBLE_COMMAND_NAMES
);

/** The command registry is intentionally limited to project identity plus the
 * source-authoritative Intent Program boundary. Raw scene,
 * part, material, profile, and animation mutation commands have no registry
 * entry and therefore cannot enter any command batch. */
const registrations = {
  'project.create': createProjectCommand,
  'project.rename': renameProjectCommand,
  'intent.program.propose': proposeIntentProgramCommand,
  'intent.program.compile': compileIntentProgramCommand
} satisfies Partial<Record<CommandName, CommandDefinition>>;

export const getCommandDefinition = (
  name: string
): CommandDefinition | undefined =>
  registrations[name as keyof typeof registrations];

export const getAgentCommandDefinition = (
  name: string
): CommandDefinition | undefined => {
  return agentAccessibleCommandNames.has(name)
    ? getCommandDefinition(name)
    : undefined;
};

export const listAgentCommandDefinitions =
  (): readonly CommandDefinition[] =>
    AGENT_ACCESSIBLE_COMMAND_NAMES.map((name) => registrations[name]);

export const commandAllowedForSource = (
  name: CommandName,
  source: CommandSource
): boolean => {
  if (!(name in registrations)) return false;
  if (source === 'system') return true;
  if (source === 'agent') {
    return agentAccessibleCommandNames.has(name);
  }
  return name === 'project.create';
};
