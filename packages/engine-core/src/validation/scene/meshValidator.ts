import type {
  MeshNode,
  ProjectDocument
} from '../../model';
import { validateVec } from '../shared/value';
import type {
  FindingSink,
  IdRegistrar
} from '../types';

export const validateMesh = (
  mesh: MeshNode,
  document: ProjectDocument,
  path: string,
  add: FindingSink,
  registerId: IdRegistrar
): void => {
  for (const [vertexKey, vertex] of Object.entries(mesh.vertices)) {
    const vertexPath = `${path}.vertices.${vertexKey}`;
    registerId(vertex.id, vertexPath);
    if (vertexKey !== vertex.id) {
      add({
        code: 'identity.key_mismatch',
        severity: 'error',
        message: `Vertex map key "${vertexKey}" does not match ID "${vertex.id}".`,
        path: vertexPath,
        entityIds: [mesh.id, vertex.id]
      });
    }
    validateVec(vertex.position, 3, `${vertexPath}.position`, add, mesh.id);
  }

  for (const [faceKey, face] of Object.entries(mesh.faces)) {
    const facePath = `${path}.faces.${faceKey}`;
    registerId(face.id, facePath);
    if (faceKey !== face.id) {
      add({
        code: 'identity.key_mismatch',
        severity: 'error',
        message: `Mesh face map key "${faceKey}" does not match ID "${face.id}".`,
        path: facePath,
        entityIds: [mesh.id, face.id]
      });
    }
    if (face.vertexIds.length < 3) {
      add({
        code: 'mesh.face_too_small',
        severity: 'error',
        message: 'A mesh face requires at least three vertices.',
        path: `${facePath}.vertexIds`,
        entityIds: [mesh.id, face.id]
      });
    }
    if (new Set(face.vertexIds).size !== face.vertexIds.length) {
      add({
        code: 'mesh.face_vertex_duplicate',
        severity: 'error',
        message: 'A mesh face cannot reference the same vertex more than once.',
        path: `${facePath}.vertexIds`,
        entityIds: [mesh.id, face.id]
      });
    }
    for (const vertexId of face.vertexIds) {
      if (!mesh.vertices[vertexId]) {
        add({
          code: 'mesh.vertex_missing',
          severity: 'error',
          message: `Mesh face references missing vertex "${vertexId}".`,
          path: `${facePath}.vertexIds`,
          entityIds: [mesh.id, face.id, vertexId]
        });
      }
    }
    for (const [vertexId, uv] of Object.entries(face.uv)) {
      if (!uv) continue;
      if (!face.vertexIds.includes(vertexId)) {
        add({
          code: 'mesh.uv_vertex_missing',
          severity: 'error',
          message: `UV references vertex "${vertexId}" outside the face.`,
          path: `${facePath}.uv.${vertexId}`,
          entityIds: [mesh.id, face.id, vertexId]
        });
      }
      validateVec(uv, 2, `${facePath}.uv.${vertexId}`, add, mesh.id);
    }
    if (face.textureId !== null && !document.textures[face.textureId]) {
      add({
        code: 'cube.texture_missing',
        severity: 'error',
        message: `Mesh face references missing texture "${face.textureId}".`,
        path: `${facePath}.textureId`,
        entityIds: [mesh.id, face.id],
        assetIds: [face.textureId]
      });
    }
  }
};
