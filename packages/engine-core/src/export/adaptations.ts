import {
  analyzeProjectAnimationCapabilities
} from '../animation/capability';
import type { ProjectDocument } from '../model';
import {
  minecraftActorAnimationNames
} from './shared/minecraftAnimation';
import type {
  ExportAdaptation,
  ExportAdaptationReceipt
} from './types';

const withoutDisposition = (
  adaptation: ReturnType<
    typeof analyzeProjectAnimationCapabilities
  >['clips'][number]['exportAdaptations'][number]
): ExportAdaptation => ({
  code: adaptation.code,
  path: adaptation.path,
  message: adaptation.message,
  clipId: adaptation.clipId,
  ...(adaptation.channelId
    ? { channelId: adaptation.channelId }
    : {}),
  ...(adaptation.triggerId
    ? { triggerId: adaptation.triggerId }
    : {}),
  ...(adaptation.keyframeId
    ? { keyframeId: adaptation.keyframeId }
    : {})
});

const minecraftNameAdaptations = (
  document: ProjectDocument
): readonly ExportAdaptation[] => {
  if (
    document.formatProfile.id !== 'minecraft.bedrock' &&
    document.formatProfile.id !== 'minecraft.java.geckolib5'
  ) {
    return [];
  }
  const names = minecraftActorAnimationNames(document);
  return Object.values(document.animations)
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((clip) => {
      const exportedName = names.get(clip.id);
      return exportedName && exportedName !== clip.name
        ? [{
            code: 'animation.name_normalized',
            path: `animations.${clip.id}.name`,
            message:
              `The export converts animation name "${clip.name}" to ` +
              `Minecraft identifier "${exportedName}" without changing the ashfox project.`,
            clipId: clip.id
          }]
        : [];
    });
};

const javaLocatorAdaptations = (
  document: ProjectDocument
): readonly ExportAdaptation[] =>
  document.formatProfile.id === 'minecraft.java_block'
    ? Object.values(document.scene.nodes)
        .filter((node) => node.kind === 'locator')
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((node) => ({
          code: 'scene.locator_unsupported',
          path: `scene.nodes.${node.id}`,
          message:
            'Java block models have no locator contract, so this export omits the locator while the ashfox project keeps it.'
        }))
    : [];

export const createExportAdaptationReceipt = (
  document: ProjectDocument
): ExportAdaptationReceipt => {
  const capability = analyzeProjectAnimationCapabilities(document);
  const animationAdaptations = capability.clips.flatMap(
    (clip) => clip.exportAdaptations
  );
  return {
    omitted: [
      ...animationAdaptations
        .filter((adaptation) => adaptation.disposition === 'omitted')
        .map(withoutDisposition),
      ...javaLocatorAdaptations(document)
    ],
    converted: [
      ...animationAdaptations
        .filter((adaptation) => adaptation.disposition === 'converted')
        .map(withoutDisposition),
      ...minecraftNameAdaptations(document)
    ]
  };
};
