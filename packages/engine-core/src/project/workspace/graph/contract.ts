import type { Sha256Digest } from '../contract';
import type { SourceRef } from '../diagnostic';

export interface WorkspaceEntrySelector {
  readonly packageName: string;
  readonly entryName: string;
}

export interface WorkspaceGraphEdge {
  /** Qualified package:path endpoints prevent cross-package path collisions. */
  readonly from: string;
  readonly to: string;
  readonly packageName: string;
  readonly specifier: string;
  readonly alias: string | null;
  readonly source: SourceRef;
}

export interface WorkspaceGraphNode {
  readonly kind: 'entry' | 'module';
  readonly packageName: string;
  readonly name: string;
  readonly path: string;
  readonly contentHash: Sha256Digest;
  readonly interfaceHash: Sha256Digest | null;
  readonly imports: readonly WorkspaceGraphEdge[];
}

export interface WorkspaceEntryBuild {
  readonly packageName: string;
  readonly entryName: string;
  readonly entryPath: string;
  readonly closureHash: Sha256Digest;
  readonly buildKey: Sha256Digest;
  readonly compilerFingerprint: string;
  readonly nodes: readonly WorkspaceGraphNode[];
  readonly edges: readonly WorkspaceGraphEdge[];
}
