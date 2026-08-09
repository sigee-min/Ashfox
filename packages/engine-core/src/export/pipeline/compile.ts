import type { ProjectDocument } from '../../model';
import {
  adaptProjectForExport,
  type ExportAdaptedDocument,
  type ExportAdapterInput
} from '../adapter';
import { exportMinecraftBedrock } from '../targets/bedrock/exporter';
import { exportGeckoLib5 } from '../targets/geckolib5/exporter';
import { exportGenericProject } from '../targets/generic/exporter';
import {
  exportGltf,
  exportGltfResolved,
  type GltfResolvedExportOptions
} from '../targets/gltf/exporter';
import { exportMinecraftJavaBlock } from '../targets/javaBlock/exporter';
import type { ExportBundle } from '../contract';

export const compileProjectBundle = (
  document: ProjectDocument,
  adapter: ExportAdapterInput
): ExportBundle => {
  const adapted = adaptProjectForExport(document, adapter);
  return compileAdaptedProjectBundle(adapted);
};

const compileAdaptedProjectBundle = (
  document: ExportAdaptedDocument
): ExportBundle => {
  switch (document.formatProfile.id) {
    case 'ashfox.generic':
      return exportGenericProject(document);
    case 'minecraft.java_block':
      return exportMinecraftJavaBlock(document);
    case 'minecraft.bedrock':
      return exportMinecraftBedrock(document);
    case 'minecraft.java.geckolib5':
      return exportGeckoLib5(document);
    case 'gltf.2':
      return exportGltf(document);
    default:
      throw new Error(
        `Unsupported export target "${String(
          (document.formatProfile as { id?: string }).id
        )}".`
      );
  }
};

export const compileProjectBundleResolved = async (
  document: ProjectDocument,
  adapter: ExportAdapterInput,
  options: GltfResolvedExportOptions
): Promise<ExportBundle> =>
  {
    const adapted = adaptProjectForExport(document, adapter);
    return adapted.formatProfile.id === 'gltf.2'
      ? exportGltfResolved(adapted, options)
      : compileAdaptedProjectBundle(adapted);
  };
