import type { CommandDefinition } from './definition';
import { alignNodesCommand } from './definitions/alignNodes';
import { closeAnimationLoopCommand } from './definitions/closeAnimationLoop';
import { createBonesCommand } from './definitions/createBones';
import { createCubesCommand } from './definitions/createCubes';
import { createLocatorsCommand } from './definitions/createLocators';
import { deleteLocatorsCommand } from './definitions/deleteLocators';
import { createProjectCommand } from './definitions/createProject';
import { deleteAnimationClipCommand } from './definitions/deleteAnimationClip';
import {
  deleteAnimationTracksCommand
} from './definitions/deleteAnimationTracks';
import { deleteNodesCommand } from './definitions/deleteNodes';
import { deleteModelPartsCommand } from './definitions/deleteModelParts';
import { duplicateCubesCommand } from './definitions/duplicateCubes';
import { mirrorAnimationChannelsCommand } from './definitions/mirrorAnimationChannels';
import { mirrorCubesCommand } from './definitions/mirrorCubes';
import { mirrorModelPartsCommand } from './definitions/mirrorModelParts';
import { phaseAnimationChannelsCommand } from './definitions/phaseAnimationChannels';
import { reparentNodesCommand } from './definitions/reparentNodes';
import { renameProjectCommand } from './definitions/renameProject';
import { renameNodesCommand } from './definitions/renameNodes';
import { repeatCubesCommand } from './definitions/repeatCubes';
import { setCubeMaterialCommand } from './definitions/setCubeMaterial';
import { setModelPartMaterialCommand } from './definitions/setModelPartMaterial';
import { setNodeVisibilityCommand } from './definitions/setNodeVisibility';
import { setNodePivotCommand } from './definitions/setNodePivot';
import { setProjectIntentCommand } from './definitions/setProjectIntent';
import {
  setProjectResourceCommand
} from './definitions/setProjectResource';
import { setProjectTargetCommand } from './definitions/setProjectTarget';
import {
  setSurfacePixelDensityCommand
} from './definitions/setSurfacePixelDensity';
import { transformNodesCommand } from './definitions/transformNodes';
import { updateLocatorsCommand } from './definitions/updateLocators';
import { transformModelPartsCommand } from './definitions/transformModelParts';
import { updateCubeGeometryCommand } from './definitions/updateCubeGeometry';
import { upsertAnimationChannelsCommand } from './definitions/upsertAnimationChannels';
import { upsertAnimationClipCommand } from './definitions/upsertAnimationClip';
import {
  upsertAnimationMotionCommand
} from './definitions/upsertAnimationMotion';
import { upsertAnimationTriggersCommand } from './definitions/upsertAnimationTriggers';
import { upsertModelPartsCommand } from './definitions/upsertModelParts';
import type { CommandName, CommandSource } from './types';

interface CommandRegistration {
  definition: CommandDefinition;
  agentAccessible: boolean;
}

const registration = (
  definition: CommandDefinition,
  agentAccessible: boolean
): CommandRegistration => ({ definition, agentAccessible });

const registrations: Readonly<Record<CommandName, CommandRegistration>> = {
  'project.create': registration(createProjectCommand, true),
  'project.rename': registration(renameProjectCommand, true),
  'project.target.set': registration(setProjectTargetCommand, true),
  'project.resource.set': registration(
    setProjectResourceCommand,
    false
  ),
  'project.intent.set': registration(setProjectIntentCommand, true),
  'model.parts.upsert': registration(upsertModelPartsCommand, true),
  'model.parts.mirror': registration(mirrorModelPartsCommand, true),
  'model.parts.transform': registration(transformModelPartsCommand, true),
  'model.parts.material': registration(setModelPartMaterialCommand, true),
  'model.parts.delete': registration(deleteModelPartsCommand, true),
  'scene.bones.create': registration(createBonesCommand, false),
  'scene.locators.create': registration(createLocatorsCommand, false),
  'scene.locators.update': registration(updateLocatorsCommand, false),
  'scene.locators.delete': registration(deleteLocatorsCommand, true),
  'scene.nodes.transform': registration(transformNodesCommand, false),
  'scene.nodes.visibility': registration(setNodeVisibilityCommand, false),
  'scene.cubes.create': registration(createCubesCommand, false),
  'scene.cubes.geometry.update': registration(
    updateCubeGeometryCommand,
    false
  ),
  'scene.nodes.rename': registration(renameNodesCommand, false),
  'scene.nodes.delete': registration(deleteNodesCommand, false),
  'scene.cubes.duplicate': registration(duplicateCubesCommand, false),
  'scene.cubes.mirror': registration(mirrorCubesCommand, false),
  'scene.cubes.repeat': registration(repeatCubesCommand, false),
  'scene.nodes.align': registration(alignNodesCommand, false),
  'scene.nodes.pivot': registration(setNodePivotCommand, false),
  'scene.nodes.reparent': registration(reparentNodesCommand, false),
  'scene.cubes.material': registration(setCubeMaterialCommand, false),
  'textures.density.set': registration(
    setSurfacePixelDensityCommand,
    false
  ),
  'animation.clip.upsert': registration(upsertAnimationClipCommand, false),
  'animation.motion.upsert': registration(
    upsertAnimationMotionCommand,
    true
  ),
  'animation.channels.upsert': registration(
    upsertAnimationChannelsCommand,
    false
  ),
  'animation.triggers.upsert': registration(
    upsertAnimationTriggersCommand,
    false
  ),
  'animation.tracks.delete': registration(
    deleteAnimationTracksCommand,
    false
  ),
  'animation.channels.phase': registration(
    phaseAnimationChannelsCommand,
    false
  ),
  'animation.channels.mirror': registration(
    mirrorAnimationChannelsCommand,
    false
  ),
  'animation.clip.closeLoop': registration(
    closeAnimationLoopCommand,
    false
  ),
  'animation.clip.delete': registration(deleteAnimationClipCommand, true)
};

export const commandRegistry = Object.fromEntries(
  Object.entries(registrations).map(([name, value]) => [
    name,
    value.definition
  ])
) as Readonly<Record<CommandName, CommandDefinition>>;

export const getCommandDefinition = (
  name: string
): CommandDefinition | undefined =>
  registrations[name as CommandName]?.definition;

export const listCommandDefinitions = (): readonly CommandDefinition[] =>
  Object.values(registrations).map((entry) => entry.definition);

export const getAgentCommandDefinition = (
  name: string
): CommandDefinition | undefined => {
  const value = registrations[name as CommandName];
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
): boolean =>
  source !== 'agent' ||
  registrations[name].agentAccessible;
