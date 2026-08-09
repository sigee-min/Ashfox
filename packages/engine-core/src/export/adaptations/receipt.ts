import type { ExportAdaptedDocument } from '../adapter';
import type { ExportAdaptationReceipt } from '../contract';
import {
  animationExportAdaptations
} from './animation';
import {
  minecraftNameAdaptations
} from '../minecraft/adapt';
import {
  sceneExportAdaptations
} from './scene';

export const createExportAdaptationReceipt = (
  document: ExportAdaptedDocument
): ExportAdaptationReceipt => {
  const animation = animationExportAdaptations(document);
  return {
    omitted: [
      ...animation.omitted,
      ...sceneExportAdaptations(document)
    ],
    converted: [
      ...animation.converted,
      ...minecraftNameAdaptations(document)
    ]
  };
};
