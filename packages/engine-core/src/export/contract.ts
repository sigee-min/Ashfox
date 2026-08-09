import { INTERNAL_CONTRACT_VERSIONS } from '@ashfox/internal-contracts';

import type { BlobRef, JsonValue, ProjectId, Revision } from '../model';
import type { InvariantFinding } from '../validation';

export const EXPORT_BUNDLE_SCHEMA_VERSION =
  INTERNAL_CONTRACT_VERSIONS.exportBundle;

export type ExportTargetId =
  | 'ashfox.generic'
  | 'minecraft.java_block'
  | 'minecraft.bedrock'
  | 'minecraft.java.geckolib5'
  | 'gltf.2';

export type ExportFileRole =
  | 'model'
  | 'blockstate'
  | 'geometry'
  | 'animation'
  | 'texture'
  | 'buffer'
  | 'manifest';

export interface JsonExportFile {
  kind: 'json';
  role: ExportFileRole;
  path: string;
  contentType: 'application/json' | 'model/gltf+json';
  data: JsonValue;
  text: string;
}

export interface BlobCopyExportFile {
  kind: 'blob-copy';
  role: 'texture';
  path: string;
  contentType: string;
  source: BlobRef;
}

export interface BinaryExportFile {
  kind: 'binary';
  role: 'model' | 'buffer';
  path: string;
  contentType: 'application/octet-stream' | 'model/gltf-binary';
  data: Uint8Array;
}

export type ExportFile =
  | JsonExportFile
  | BlobCopyExportFile
  | BinaryExportFile;

export interface ExportAdaptation {
  code: string;
  path: string;
  message: string;
  clipId?: string;
  channelId?: string;
  triggerId?: string;
  keyframeId?: string;
}

export interface ExportAdaptationReceipt {
  omitted: readonly ExportAdaptation[];
  converted: readonly ExportAdaptation[];
}

export interface ExportBundle {
  schemaVersion: typeof EXPORT_BUNDLE_SCHEMA_VERSION;
  projectId: ProjectId;
  revision: Revision;
  target: {
    id: ExportTargetId;
    version: string;
  };
  rootPath: string;
  entrypoints: readonly string[];
  files: readonly ExportFile[];
  findings: readonly InvariantFinding[];
  adaptations: ExportAdaptationReceipt;
}

export interface ResolvedBlob {
  bytes: Uint8Array;
  contentType: string;
}

export type BlobResolver = (
  source: BlobRef
) => Promise<ResolvedBlob | null>;

export type BlobResolutionErrorCode =
  | 'blob.not_found'
  | 'blob.read_failed'
  | 'blob.invalid_bytes'
  | 'blob.content_type_mismatch'
  | 'blob.byte_length_mismatch';

export class ExportMaterializationRequiredError extends Error {
  readonly code = 'export.blob_resolution_required' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ExportMaterializationRequiredError';
  }
}

export class BlobResolutionError extends Error {
  readonly code: BlobResolutionErrorCode;
  readonly assetId: string;
  readonly source: BlobRef;

  constructor(
    code: BlobResolutionErrorCode,
    assetId: string,
    source: BlobRef,
    message: string
  ) {
    super(message);
    this.name = 'BlobResolutionError';
    this.code = code;
    this.assetId = assetId;
    this.source = source;
  }
}

export class ProjectExportError extends Error {
  readonly findings: readonly InvariantFinding[];

  constructor(message: string, findings: readonly InvariantFinding[]) {
    const first = findings.find((finding) => finding.severity === 'error') ??
      findings[0];
    super(
      first
        ? `${message} ${first.path}: ${first.message}`
        : message
    );
    this.name = 'ProjectExportError';
    this.findings = findings;
  }
}
