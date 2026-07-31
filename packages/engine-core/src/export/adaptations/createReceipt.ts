import type { ProjectDocument } from '../../model';
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
  document: ProjectDocument
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
