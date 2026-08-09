import type { ExportAdaptedDocument } from '../adapter';
import type { ExportAdaptationReceipt } from '../types';
import {
  animationExportAdaptations
} from './animationAdaptations';
import {
  minecraftNameAdaptations
} from './minecraftNameAdaptations';
import {
  sceneExportAdaptations
} from './sceneAdaptations';

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
