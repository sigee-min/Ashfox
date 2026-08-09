import type { ToolError } from '@ashfox/blockbench-contracts/types/internal';
import type { EditorPort } from '../../../ports/editor';
import type { ProjectSession, SessionState } from '../../../session';
import type { MeshUvPolicy } from '../../../domain/mesh/autoUv';

export type MeshVertexInput = {
  id: string;
  pos: [number, number, number];
};

export type MeshFaceUvInput = {
  vertexId: string;
  uv: [number, number];
};

export type MeshFaceInput = {
  id?: string;
  vertices: string[];
  uv?: MeshFaceUvInput[];
  texture?: string | false;
};

export type AutoMappedMesh = {
  faces: MeshFaceInput[];
  policy: Required<MeshUvPolicy>;
};

export interface MeshServiceDeps {
  readonly session: ProjectSession;
  readonly editor: EditorPort;
  readonly getSnapshot: () => SessionState;
  readonly ensureActive: () => ToolError | null;
  readonly ensureRevisionMatch: (ifRevision?: string) => ToolError | null;
}

export type AddMeshPayload = {
  id?: string;
  name: string;
  bone?: string;
  boneId?: string;
  origin?: [number, number, number];
  rotation?: [number, number, number];
  visibility?: boolean;
  uvPolicy?: MeshUvPolicy;
  vertices: MeshVertexInput[];
  faces: MeshFaceInput[];
  ifRevision?: string;
};

export type UpdateMeshPayload = {
  id?: string;
  name?: string;
  newName?: string;
  bone?: string;
  boneId?: string;
  boneRoot?: boolean;
  origin?: [number, number, number];
  rotation?: [number, number, number];
  visibility?: boolean;
  uvPolicy?: MeshUvPolicy;
  vertices?: MeshVertexInput[];
  faces?: MeshFaceInput[];
  ifRevision?: string;
};

export type DeleteMeshPayload = {
  id?: string;
  name?: string;
  ids?: string[];
  names?: string[];
  ifRevision?: string;
};
