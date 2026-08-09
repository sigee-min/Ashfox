import type { ExportAdaptedDocument } from '../adapter';
import type { ExportAdaptation } from '../contract';

export const sceneExportAdaptations = (
  document: ExportAdaptedDocument
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
