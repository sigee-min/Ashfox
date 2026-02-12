import type { EditorPort } from '../../ports/editor';
import type { SessionState } from '../../session';
import type { ExportResult } from '@ashfox/contracts/types/internal';
import { buildInternalExport } from '../../domain/exporters';
import type { NonGltfExportFormat } from '../../domain/export/types';
import { fail, ok, type UsecaseResult } from '../result';

const stripKnownExt = (destPath: string): string => {
  if (destPath.endsWith('.geo.json')) return destPath.slice(0, -'.geo.json'.length);
  if (destPath.endsWith('.animation.json')) return destPath.slice(0, -'.animation.json'.length);
  if (destPath.endsWith('.json')) return destPath.slice(0, -'.json'.length);
  return destPath;
};

const resolveArtifactPath = (
  destPath: string,
  path: { mode: 'destination' } | { mode: 'base_suffix'; suffix: string }
): string => {
  if (path.mode === 'destination') return destPath;
  return `${stripKnownExt(destPath)}${path.suffix}`;
};

export const writeInternalFallbackExport = (
  editor: EditorPort,
  format: NonGltfExportFormat,
  destPath: string,
  snapshot: SessionState,
  options?: {
    selectedTarget?: ExportResult['selectedTarget'];
    stage?: ExportResult['stage'];
    warnings?: string[];
  }
): UsecaseResult<ExportResult> => {
  const bundle = buildInternalExport(format, snapshot);
  const writes = bundle.artifacts.map((artifact) => ({
    id: artifact.id,
    path: resolveArtifactPath(destPath, artifact.path),
    data: artifact.data,
    primary: artifact.primary === true
  }));
  if (writes.length === 0) {
    return fail({
      code: 'unknown',
      message: `No codec artifacts generated for ${format}.`,
      details: { format }
    });
  }
  const primaryWrite = writes.find((write) => write.primary) ?? writes[0];
  for (const write of writes) {
    const serialized = JSON.stringify(write.data, null, 2);
    const err = editor.writeFile(write.path, serialized);
    if (err) return fail(err);
  }
  const artifactWarnings =
    writes.length <= 1
      ? []
      : writes
          .filter((write) => write !== primaryWrite)
          .map((write) => `additional artifact written: ${write.path}`);
  const warnings = [...(options?.warnings ?? []), ...bundle.warnings, ...artifactWarnings];
  return ok({
    path: primaryWrite.path,
    ...(options?.selectedTarget ? { selectedTarget: options.selectedTarget } : {}),
    ...(options?.stage ? { stage: options.stage } : {}),
    ...(warnings.length > 0 ? { warnings } : {})
  });
};
