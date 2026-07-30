import {
  CUBE_FACE_DIRECTIONS,
  type ProjectDocument
} from '../../model';
import { defineCommand } from '../definition';

const textureIdsSchema = {
  type: 'array',
  items: {
    type: 'string',
    minLength: 1
  },
  minItems: 1,
  maxItems: 128,
  uniqueItems: true
} as const;

const inputSchema = {
  type: 'object',
  properties: {
    textureIds: textureIdsSchema
  },
  required: ['textureIds'],
  additionalProperties: false
} as const;

interface TextureReference {
  nodeId: string;
  faceId: string;
}

const textureReference = (
  document: ProjectDocument,
  textureId: string
): TextureReference | null => {
  for (const node of Object.values(document.scene.nodes)) {
    if (node.kind === 'cube') {
      const direction = CUBE_FACE_DIRECTIONS.find(
        (candidate) =>
          node.faces[candidate].textureId === textureId
      );
      if (direction) {
        return {
          nodeId: node.id,
          faceId: direction
        };
      }
    }
    if (node.kind === 'mesh') {
      const face = Object.values(node.faces).find(
        (candidate) => candidate.textureId === textureId
      );
      if (face) {
        return {
          nodeId: node.id,
          faceId: face.id
        };
      }
    }
  }
  return null;
};

export const deleteTexturesCommand = defineCommand({
  name: 'textures.delete',
  label: 'Delete textures',
  purpose:
    'Delete unreferenced textures without silently changing scene materials.',
  inputSchema,
  apply: (document, payload) => {
    const missingId = payload.textureIds.find(
      (textureId) => document.textures[textureId] === undefined
    );
    if (missingId) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: `Texture "${missingId}" does not exist.`,
          path: 'payload.textureIds'
        }
      };
    }
    for (const textureId of payload.textureIds) {
      const reference = textureReference(document, textureId);
      if (reference) {
        return {
          ok: false,
          error: {
            code: 'invalid_state',
            message:
              `Texture "${textureId}" is referenced by scene node ` +
              `"${reference.nodeId}" face "${reference.faceId}".`,
            path: 'payload.textureIds',
            expected:
              'unassign the texture from every face before deletion'
          }
        };
      }
    }
    const deleted = new Set(payload.textureIds);
    const deletedDetailIds = payload.textureIds.flatMap(
      (textureId) =>
        document.textures[textureId].raster?.canvasDetails.map(
          (detail) => detail.id
        ) ?? []
    );
    const textures = Object.fromEntries(
      Object.entries(document.textures).filter(
        ([textureId]) => !deleted.has(textureId)
      )
    );
    return {
      ok: true,
      value: {
        document: {
          ...document,
          textures
        },
        summary:
          payload.textureIds.length === 1
            ? `Delete ${document.textures[payload.textureIds[0]].name}`
            : `Delete ${payload.textureIds.length} textures`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: [],
          removedEntityIds: [
            ...payload.textureIds,
            ...deletedDetailIds
          ],
          invalidated: [
            'textures',
            'uv',
            'validation',
            'preview'
          ]
        }
      }
    };
  }
});
