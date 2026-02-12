import type { ExportPayload } from '@ashfox/contracts/types/internal';
import type { SessionState } from '../session';
import type { NonGltfExportFormat } from './export/types';
import { buildCanonicalExportModel } from './export/canonicalModel';
import { CodecRegistry } from './export/codecRegistry';
import type { CodecArtifact } from './export/codecs/types';

export type ExportKind = ExportPayload['format'];

export interface ExportBundle {
  format: NonGltfExportFormat;
  data: unknown;
  artifacts: CodecArtifact[];
  warnings: string[];
  lossy: boolean;
}

const DEFAULT_CODEC_REGISTRY = new CodecRegistry();

const attachMeta = (
  artifact: CodecArtifact,
  format: NonGltfExportFormat,
  state: SessionState
): CodecArtifact => {
  if (!artifact.data || typeof artifact.data !== 'object' || Array.isArray(artifact.data)) {
    return artifact;
  }
  return {
    ...artifact,
    data: {
      ...(artifact.data as Record<string, unknown>),
      ashfox_meta: {
        schema: 'internal',
        format,
        name: state.name ?? null,
        artifact: artifact.id
      }
    }
  };
};

const primaryArtifact = (artifacts: CodecArtifact[]): CodecArtifact =>
  artifacts.find((artifact) => artifact.primary) ?? artifacts[0];

export function buildInternalExport(
  format: NonGltfExportFormat,
  state: SessionState
): ExportBundle {
  const strategyResult = DEFAULT_CODEC_REGISTRY.resolve(format);
  if (!strategyResult.ok) {
    const fallbackArtifact: CodecArtifact = {
      id: 'snapshot',
      path: { mode: 'destination' },
      primary: true,
      data: {
        meta: { formatId: state.formatId ?? null, name: state.name },
        bones: state.bones,
        cubes: state.cubes,
        meshes: state.meshes ?? [],
        textures: state.textures,
        animations: state.animations
      }
    };
    const fallbackWithMeta = attachMeta(fallbackArtifact, format, state);
    return {
      format,
      data: fallbackWithMeta.data,
      artifacts: [fallbackWithMeta],
      warnings: [strategyResult.error.message],
      lossy: true
    };
  }
  const model = buildCanonicalExportModel(state);
  const encoded = strategyResult.data.encode(model);
  const artifactsWithMeta = encoded.artifacts.map((artifact) => attachMeta(artifact, format, state));
  const primary = primaryArtifact(artifactsWithMeta);
  return {
    format,
    data: primary.data,
    artifacts: artifactsWithMeta,
    warnings: encoded.warnings ?? [],
    lossy: Boolean(encoded.lossy)
  };
}
