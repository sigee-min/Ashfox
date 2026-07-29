import type { CommandDefinition } from './definition';
import { alignNodesCommand } from './definitions/alignNodes';
import { closeAnimationLoopCommand } from './definitions/closeAnimationLoop';
import { createBonesCommand } from './definitions/createBones';
import { createCubesCommand } from './definitions/createCubes';
import { deleteAnimationClipCommand } from './definitions/deleteAnimationClip';
import { deleteNodesCommand } from './definitions/deleteNodes';
import { duplicateCubesCommand } from './definitions/duplicateCubes';
import { fitCubeUvCommand } from './definitions/fitCubeUv';
import { generateMinecraftUvAtlasCommand } from './definitions/generateMinecraftUvAtlas';
import { mirrorAnimationChannelsCommand } from './definitions/mirrorAnimationChannels';
import { mirrorCubesCommand } from './definitions/mirrorCubes';
import { phaseAnimationChannelsCommand } from './definitions/phaseAnimationChannels';
import { reparentNodesCommand } from './definitions/reparentNodes';
import { renameProjectCommand } from './definitions/renameProject';
import { renameTextureCommand } from './definitions/renameTexture';
import { repeatCubesCommand } from './definitions/repeatCubes';
import { setCubeMaterialCommand } from './definitions/setCubeMaterial';
import { setNodeVisibilityCommand } from './definitions/setNodeVisibility';
import { setNodePivotCommand } from './definitions/setNodePivot';
import { setProjectTargetCommand } from './definitions/setProjectTarget';
import { setTexturePreviewCommand } from './definitions/setTexturePreview';
import { setTextureRasterCommand } from './definitions/setTextureRaster';
import { transformNodesCommand } from './definitions/transformNodes';
import { upsertAnimationChannelsCommand } from './definitions/upsertAnimationChannels';
import { upsertAnimationClipCommand } from './definitions/upsertAnimationClip';
import { upsertAnimationTriggersCommand } from './definitions/upsertAnimationTriggers';
import type { CommandName } from './types';

const definitions: Readonly<Record<CommandName, CommandDefinition>> = {
  'project.rename': renameProjectCommand,
  'project.target.set': setProjectTargetCommand,
  'scene.bones.create': createBonesCommand,
  'scene.nodes.transform': transformNodesCommand,
  'scene.nodes.visibility': setNodeVisibilityCommand,
  'scene.cubes.create': createCubesCommand,
  'scene.nodes.delete': deleteNodesCommand,
  'scene.cubes.duplicate': duplicateCubesCommand,
  'scene.cubes.mirror': mirrorCubesCommand,
  'scene.cubes.repeat': repeatCubesCommand,
  'scene.nodes.align': alignNodesCommand,
  'scene.nodes.pivot': setNodePivotCommand,
  'scene.nodes.reparent': reparentNodesCommand,
  'scene.cubes.uv.fit': fitCubeUvCommand,
  'scene.cubes.material': setCubeMaterialCommand,
  'textures.preview.set': setTexturePreviewCommand,
  'textures.rename': renameTextureCommand,
  'textures.raster.set': setTextureRasterCommand,
  'textures.uvAtlas.generate': generateMinecraftUvAtlasCommand,
  'animation.clip.upsert': upsertAnimationClipCommand,
  'animation.channels.upsert': upsertAnimationChannelsCommand,
  'animation.triggers.upsert': upsertAnimationTriggersCommand,
  'animation.channels.phase': phaseAnimationChannelsCommand,
  'animation.channels.mirror': mirrorAnimationChannelsCommand,
  'animation.clip.closeLoop': closeAnimationLoopCommand,
  'animation.clip.delete': deleteAnimationClipCommand
};

export const commandRegistry = definitions;

export const getCommandDefinition = (
  name: string
): CommandDefinition | undefined =>
  definitions[name as CommandName];

export const listCommandDefinitions = (): readonly CommandDefinition[] =>
  Object.values(definitions);
