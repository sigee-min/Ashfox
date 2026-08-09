import type { ProjectDocument } from '../../model';
import type { PartInvariantIssue } from '../invariants';
import type { PartMaterialDefinition, PartSpec } from './index';

export interface CompilePartSceneInput {
  readonly parts: readonly PartSpec[];
  readonly materials: readonly PartMaterialDefinition[];
  readonly textureId: string;
}

export interface CompilePartSceneSuccess {
  readonly ok: true;
  readonly document: ProjectDocument;
  readonly projectedParts: readonly PartSpec[];
  readonly createdIds: readonly string[];
  readonly changedIds: readonly string[];
  readonly removedIds: readonly string[];
}

export interface CompilePartSceneFailure {
  readonly ok: false;
  readonly code:
    | 'invalid_existing_model'
    | 'missing_parent'
    | 'missing_material'
    | 'id_collision'
    | 'geometry';
  readonly path: string;
  readonly pathScope: 'payload' | 'document';
  readonly message: string;
  readonly issues?: readonly PartInvariantIssue[];
}

export type CompilePartSceneResult =
  | CompilePartSceneSuccess
  | CompilePartSceneFailure;

/** Single diagnostic owner shared by preparation, emission, and validation. */
export const partCompilationFailure = (
  code: CompilePartSceneFailure['code'],
  path: string,
  message: string,
  issues?: readonly PartInvariantIssue[],
  pathScope: CompilePartSceneFailure['pathScope'] =
    path.startsWith('scene.') ? 'document' : 'payload'
): CompilePartSceneFailure => ({
  ok: false,
  code,
  path,
  pathScope,
  message,
  ...(issues ? { issues } : {})
});
