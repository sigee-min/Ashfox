import type { CommandDefinition } from './definition';
import { createProjectCommand } from './definitions/createProject';
import {
  compileIntentProgramCommand
} from './definitions/intentProgramCompile';
import {
  proposeIntentProgramCommand
} from './definitions/intentProgramPropose';
import { renameProjectCommand } from './definitions/renameProject';
import type { CommandName, CommandSource } from './types';

interface CommandRegistration {
  definition: CommandDefinition;
  agentAccessible: boolean;
}

const registration = (
  definition: CommandDefinition,
  agentAccessible: boolean
): CommandRegistration => ({ definition, agentAccessible });

/** The command registry is intentionally limited to project identity plus the
 * source-authoritative Intent Program boundary. Raw scene,
 * part, material, profile, and animation mutation commands have no registry
 * entry and therefore cannot enter any command batch. */
const registrations = {
  'project.create': registration(createProjectCommand, false),
  'project.rename': registration(renameProjectCommand, false),
  'intent.program.propose': registration(proposeIntentProgramCommand, true),
  'intent.program.compile': registration(compileIntentProgramCommand, false)
} satisfies Partial<Record<CommandName, CommandRegistration>>;

export const commandRegistry = Object.fromEntries(
  Object.entries(registrations).map(([name, value]) => [
    name,
    value.definition
  ])
) as Readonly<Partial<Record<CommandName, CommandDefinition>>>;

export const getCommandDefinition = (
  name: string
): CommandDefinition | undefined =>
  registrations[name as keyof typeof registrations]?.definition;

export const listCommandDefinitions = (): readonly CommandDefinition[] =>
  Object.values(registrations).map((entry) => entry.definition);

export const getAgentCommandDefinition = (
  name: string
): CommandDefinition | undefined => {
  const value = registrations[name as keyof typeof registrations];
  return value?.agentAccessible ? value.definition : undefined;
};

export const listAgentCommandDefinitions =
  (): readonly CommandDefinition[] =>
    Object.values(registrations)
      .filter((entry) => entry.agentAccessible)
      .map((entry) => entry.definition);

export const commandAllowedForSource = (
  name: CommandName,
  source: CommandSource
): boolean => {
  if (!(name in registrations)) return false;
  if (name === 'intent.program.propose') {
    return source === 'agent' || source === 'web';
  }
  return source === 'web' || source === 'system';
};
