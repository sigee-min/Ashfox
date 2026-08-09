import type {
  ProjectDocument,
  Revision
} from '../model';
import type {
  IntentProgramDiagnostic
} from '../project/program';

export const ASHFOX_PROJECT_FILE_EXTENSION = '.ashfox' as const;
export const ASHFOX_PROJECT_FILE_CONTENT_TYPE =
  'text/x-ashfox;charset=utf-8' as const;

/** Host-owned identity for a source file that contains no session metadata. */
export interface ProjectFileIdentitySeed {
  readonly id: string;
  readonly revision: Revision;
  readonly createdAt: string;
}

export interface OpenProjectFileInput {
  /** Exact UTF-8-decoded file text. It is never normalized before hashing. */
  readonly source: string;
  readonly identity: ProjectFileIdentitySeed;
}

export type OpenProjectFileResult =
  | {
      readonly ok: true;
      readonly document: ProjectDocument;
      readonly diagnostics: readonly IntentProgramDiagnostic[];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly IntentProgramDiagnostic[];
    };

export type ProjectFileSerializationErrorCode =
  | 'project-file.missing_source'
  | 'project-file.pending_source'
  | 'project-file.invalid_source';

export interface ProjectFileSerializationError {
  readonly code: ProjectFileSerializationErrorCode;
  readonly message: string;
  readonly path: string;
}

export type SerializeProjectFileResult =
  | { readonly ok: true; readonly source: string }
  | { readonly ok: false; readonly error: ProjectFileSerializationError };
