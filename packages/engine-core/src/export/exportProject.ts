import type { ProjectDocument } from '../model';
import {
  evaluateProductionReadiness,
  type ProductionReadinessReport
} from '../productionReadiness';
import { validateProjectDocument } from '../validation';
import { createExportAdaptationReceipt } from './adaptations';
import { createJsonExportFile } from './json';
import { exportMinecraftBedrock } from './targets/bedrock/exporter';
import { exportGeckoLib5 } from './targets/geckolib5/exporter';
import {
  exportGltf,
  exportGltfResolved,
  type GltfResolvedExportOptions
} from './targets/gltf/exporter';
import { exportMinecraftJavaBlock } from './targets/javaBlock/exporter';
import { ProjectExportError, type ExportBundle } from './types';

const exportGenericProject = (document: ProjectDocument): ExportBundle => {
  const report = validateProjectDocument(document, { includeFormatProfile: false });
  if (!report.valid) {
    throw new ProjectExportError('Generic ashfox export validation failed.', report.findings);
  }
  const path = 'project.json';
  return {
    schemaVersion: 1,
    projectId: document.id,
    revision: document.revision,
    target: {
      id: 'ashfox.generic',
      version: '1'
    },
    rootPath: 'ashfox-project',
    entrypoints: [path],
    files: [
      createJsonExportFile(
        'model',
        path,
        document
      )
    ],
    findings: report.findings,
    adaptations: createExportAdaptationReceipt(document)
  };
};

export class ProductionExportError extends Error {
  readonly code = 'export.production_not_ready' as const;

  constructor(readonly report: ProductionReadinessReport) {
    const finding = report.firstBlockingFinding;
    super(
      finding
        ? `Project is not production ready: ${finding.code} at ${finding.path}.`
        : 'Project is not production ready.'
    );
    this.name = 'ProductionExportError';
  }
}

const assertProductionReady = (document: ProjectDocument): void => {
  const report = evaluateProductionReadiness(document);
  if (!report.mechanicallyReady) {
    throw new ProductionExportError(report);
  }
};

export const compileProjectBundle = (
  document: ProjectDocument
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
  options: GltfResolvedExportOptions
): Promise<ExportBundle> => {
  if (document.formatProfile.id === 'gltf.2') {
    return exportGltfResolved(document, options);
  }
  return compileProjectBundle(document);
};

export const exportProductionProject = (
  document: ProjectDocument
): ExportBundle => {
  assertProductionReady(document);
  return compileProjectBundle(document);
};

export const exportProductionProjectResolved = async (
  document: ProjectDocument,
  options: GltfResolvedExportOptions
): Promise<ExportBundle> => {
  assertProductionReady(document);
  return compileProjectBundleResolved(document, options);
};
