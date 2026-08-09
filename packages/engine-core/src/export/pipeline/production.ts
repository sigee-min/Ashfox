import type { ProjectDocument } from '../../model';
import type { ExportAdapterInput } from '../adapter';
import {
  evaluateProductionReadiness,
  type ProductionReadinessReport
} from '../../readiness';
import type { GltfResolvedExportOptions } from '../targets/gltf/exporter';
import type { ExportBundle } from '../contract';
import {
  compileProjectBundle,
  compileProjectBundleResolved
} from './compile';

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

export const exportProductionProject = (
  document: ProjectDocument,
  adapter: ExportAdapterInput
): ExportBundle => {
  assertProductionReady(document);
  return compileProjectBundle(document, adapter);
};

export const exportProductionProjectResolved = async (
  document: ProjectDocument,
  adapter: ExportAdapterInput,
  options: GltfResolvedExportOptions
): Promise<ExportBundle> => {
  assertProductionReady(document);
  return compileProjectBundleResolved(document, adapter, options);
};
