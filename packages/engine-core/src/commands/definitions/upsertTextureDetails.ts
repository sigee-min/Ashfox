import {
  CUBE_FACE_DIRECTIONS,
  type CubeFaceDirection,
  type ProjectDocument,
  type TextureCanvasDetail,
  type SurfaceTextureDetail
} from '../../model';
import { updateSceneNode } from '../../scene';
import {
  MAX_PROJECT_TEXTURE_DETAILS,
  projectTextureDetailCount,
  projectTextureDetailIds
} from '../../textures/surfaceDetails';
import { defineCommand } from '../definition';
import type { TextureDetailUpsertInput } from '../types';
import { colorSchema, entityIdsSchema } from './schemas';

const canvasAnchorSchema = {
  type: 'object',
  properties: {
    kind: { enum: ['canvas'] },
    x: { type: 'number', minimum: 0 },
    y: { type: 'number', minimum: 0 },
    width: { type: 'number', minimum: 1 },
    height: { type: 'number', minimum: 1 }
  },
  required: ['kind', 'x', 'y', 'width', 'height'],
  additionalProperties: false
} as const;

const surfaceAnchorSchema = {
  type: 'object',
  properties: {
    kind: { enum: ['surface'] },
    nodeId: { type: 'string', minLength: 1 },
    face: { enum: CUBE_FACE_DIRECTIONS },
    u: { type: 'number', minimum: 0, maximum: 1 },
    v: { type: 'number', minimum: 0, maximum: 1 },
    width: { type: 'number', minimum: 0, maximum: 1 },
    height: { type: 'number', minimum: 0, maximum: 1 }
  },
  required: ['kind', 'nodeId', 'face', 'u', 'v', 'width', 'height'],
  additionalProperties: false
} as const;

const detailSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', minLength: 1 },
    color: colorSchema,
    anchor: {
      anyOf: [surfaceAnchorSchema, canvasAnchorSchema]
    }
  },
  required: ['id', 'color', 'anchor'],
  additionalProperties: false
} as const;

const inputSchema = {
  type: 'object',
  properties: {
    textureId: {
      type: 'string',
      minLength: 1
    },
    background: colorSchema,
    upsert: {
      type: 'array',
      items: detailSchema,
      maxItems: 512
    },
    removeIds: entityIdsSchema
  },
  required: ['textureId'],
  additionalProperties: false
} as const;

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const invalidCanvasDetail = (
  detail: TextureDetailUpsertInput,
  width: number,
  height: number
): boolean => {
  if (detail.anchor.kind !== 'canvas') return false;
  const anchor = detail.anchor;
  return (
    !Number.isInteger(anchor.x) ||
    !Number.isInteger(anchor.y) ||
    !Number.isInteger(anchor.width) ||
    !Number.isInteger(anchor.height) ||
    anchor.x + anchor.width > width ||
    anchor.y + anchor.height > height
  );
};

const surfaceDetail = (
  input: TextureDetailUpsertInput
): SurfaceTextureDetail | null =>
  input.anchor.kind === 'surface'
    ? {
        id: input.id,
        color: input.color,
        u: input.anchor.u,
        v: input.anchor.v,
        width: input.anchor.width,
        height: input.anchor.height
      }
    : null;

const canvasDetail = (
  input: TextureDetailUpsertInput
): TextureCanvasDetail | null =>
  input.anchor.kind === 'canvas'
    ? {
        id: input.id,
        color: input.color,
        x: input.anchor.x,
        y: input.anchor.y,
        width: input.anchor.width,
        height: input.anchor.height
      }
    : null;

type DetailOwner =
  | {
      kind: 'surface';
      textureId: string | null;
      nodeId: string;
      face: CubeFaceDirection;
      detail: SurfaceTextureDetail;
    }
  | {
      kind: 'canvas';
      textureId: string;
      detail: TextureCanvasDetail;
    };

const detailOwners = (
  document: ProjectDocument
): ReadonlyMap<string, DetailOwner> => {
  const owners = new Map<string, DetailOwner>();
  for (const texture of Object.values(document.textures)) {
    for (const detail of texture.raster?.canvasDetails ?? []) {
      owners.set(detail.id, {
        kind: 'canvas',
        textureId: texture.id,
        detail
      });
    }
  }
  for (const node of Object.values(document.scene.nodes)) {
    if (node.kind !== 'cube') continue;
    for (const face of CUBE_FACE_DIRECTIONS) {
      for (const detail of node.faces[face].details) {
        owners.set(detail.id, {
          kind: 'surface',
          textureId: node.faces[face].textureId,
          nodeId: node.id,
          face,
          detail
        });
      }
    }
  }
  return owners;
};

const sameColor = (left: string, right: string): boolean =>
  left.toLowerCase() === right.toLowerCase();

const inputMatchesOwner = (
  input: TextureDetailUpsertInput,
  owner: DetailOwner | undefined
): boolean => {
  if (!owner || input.anchor.kind !== owner.kind) return false;
  if (!sameColor(input.color, owner.detail.color)) return false;
  if (owner.kind === 'canvas' && input.anchor.kind === 'canvas') {
    return (
      input.anchor.x === owner.detail.x &&
      input.anchor.y === owner.detail.y &&
      input.anchor.width === owner.detail.width &&
      input.anchor.height === owner.detail.height
    );
  }
  if (owner.kind === 'surface' && input.anchor.kind === 'surface') {
    return (
      input.anchor.nodeId === owner.nodeId &&
      input.anchor.face === owner.face &&
      input.anchor.u === owner.detail.u &&
      input.anchor.v === owner.detail.v &&
      input.anchor.width === owner.detail.width &&
      input.anchor.height === owner.detail.height
    );
  }
  return false;
};

const sameAnchor = (
  input: TextureDetailUpsertInput,
  owner: DetailOwner
): boolean =>
  (
    owner.kind === 'canvas' &&
    input.anchor.kind === 'canvas'
  ) ||
  (
    owner.kind === 'surface' &&
    input.anchor.kind === 'surface' &&
    input.anchor.nodeId === owner.nodeId &&
    input.anchor.face === owner.face
  );

const removeOwnedDetail = (
  document: ProjectDocument,
  detailId: string,
  owner: DetailOwner
): ProjectDocument => {
  if (owner.kind === 'surface') {
    return updateSceneNode(document, owner.nodeId, (node) => {
      if (node.kind !== 'cube') return node;
      const face = node.faces[owner.face];
      const details = face.details.filter(
        (detail) => detail.id !== detailId
      );
      if (details.length === face.details.length) return node;
      return {
        ...node,
        faces: {
          ...node.faces,
          [owner.face]: {
            ...face,
            details
          }
        }
      };
    });
  }
  const texture = document.textures[owner.textureId];
  if (!texture?.raster) return document;
  const canvasDetails = texture.raster.canvasDetails.filter(
    (detail) => detail.id !== detailId
  );
  if (canvasDetails.length === texture.raster.canvasDetails.length) {
    return document;
  }
  return {
    ...document,
    textures: {
      ...document.textures,
      [texture.id]: {
        ...texture,
        raster: {
          ...texture.raster,
          canvasDetails
        }
      }
    }
  };
};

const writeSurfaceDetail = (
  document: ProjectDocument,
  input: TextureDetailUpsertInput,
  replaceInPlace: boolean
): ProjectDocument => {
  if (input.anchor.kind !== 'surface') return document;
  const detail = surfaceDetail(input);
  if (!detail) return document;
  const anchor = input.anchor;
  return updateSceneNode(document, anchor.nodeId, (node) => {
    if (node.kind !== 'cube') return node;
    const face = node.faces[anchor.face];
    const details = replaceInPlace
      ? face.details.map((current) =>
          current.id === detail.id ? detail : current
        )
      : [...face.details, detail];
    return {
      ...node,
      faces: {
        ...node.faces,
        [anchor.face]: {
          ...face,
          details
        }
      }
    };
  });
};

const writeCanvasDetail = (
  document: ProjectDocument,
  textureId: string,
  input: TextureDetailUpsertInput,
  replaceInPlace: boolean
): ProjectDocument => {
  const detail = canvasDetail(input);
  const texture = document.textures[textureId];
  if (!detail || !texture.raster) return document;
  const canvasDetails = replaceInPlace
    ? texture.raster.canvasDetails.map((current) =>
        current.id === detail.id ? detail : current
      )
    : [...texture.raster.canvasDetails, detail];
  return {
    ...document,
    textures: {
      ...document.textures,
      [texture.id]: {
        ...texture,
        raster: {
          ...texture.raster,
          canvasDetails
        }
      }
    }
  };
};

export const upsertTextureDetailsCommand = defineCommand({
  name: 'textures.details.upsert',
  label: 'Update texture details',
  purpose:
    'Atomically set base color and add, move, replace, or remove stable surface or canvas details.',
  inputSchema,
  apply: (document, payload) => {
    const texture = document.textures[payload.textureId];
    const upsert = payload.upsert ?? [];
    const removeIds = payload.removeIds ?? [];
    const upsertIds = upsert.map((detail) => detail.id);
    const duplicateId = upsertIds.find(
      (id, index) => upsertIds.indexOf(id) !== index
    );
    const invalidDetail = upsert.find((detail) => {
      if (!COLOR_PATTERN.test(detail.color)) return true;
      if (detail.anchor.kind === 'canvas') {
        return (
          texture?.atlasMode === 'generate' ||
          invalidCanvasDetail(
            detail,
            texture?.width ?? 0,
            texture?.height ?? 0
          )
        );
      }
      const node = document.scene.nodes[detail.anchor.nodeId];
      const face = node?.kind === 'cube'
        ? node.faces[detail.anchor.face]
        : undefined;
      return (
        texture?.atlasMode !== 'generate' ||
        !face?.enabled ||
        face.textureId !== payload.textureId ||
        (face.rotation ?? 0) !== 0 ||
        detail.anchor.width <= 0 ||
        detail.anchor.height <= 0 ||
        detail.anchor.u + detail.anchor.width > 1 ||
        detail.anchor.v + detail.anchor.height > 1
      );
    });
    const hasChange =
      payload.background !== undefined ||
      upsert.length > 0 ||
      removeIds.length > 0;
    if (
      !texture ||
      !hasChange ||
      duplicateId ||
      (
        payload.background !== undefined &&
        !COLOR_PATTERN.test(payload.background)
      ) ||
      invalidDetail
    ) {
      return {
        ok: false,
        error: {
          code: texture ? 'invalid_payload' : 'invalid_state',
          message: !texture
            ? `Texture "${payload.textureId}" does not exist.`
            : !hasChange
              ? 'A background, detail upsert, or detail removal is required.'
              : duplicateId
                ? `Texture detail ID "${duplicateId}" is duplicated.`
                : (
                    'Generated textures require face-bound normalized details; ' +
                    'preserved textures require integer canvas details.'
                  ),
          path: texture
            ? 'payload'
            : 'payload.textureId'
        }
      };
    }

    if (
      texture.atlasMode === 'preserve' &&
      !texture.raster &&
      (payload.background !== undefined || upsert.length > 0)
    ) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message:
            `Texture "${texture.id}" has immutable external pixels. ` +
            'Create a procedural preserve texture with textures.create ' +
            'for editable canvas details.',
          path: 'payload.textureId',
          expected: 'procedural preserve texture with an editable raster'
        }
      };
    }

    const owners = detailOwners(document);
    const foreignRemovalId = removeIds.find((id) => {
      const owner = owners.get(id);
      return owner !== undefined && owner.textureId !== texture.id;
    });
    const foreignUpsertId = upsertIds.find((id) => {
      const owner = owners.get(id);
      return owner !== undefined && owner.textureId !== texture.id;
    });
    if (foreignRemovalId || foreignUpsertId) {
      const detailId = foreignRemovalId ?? foreignUpsertId;
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message:
            `Texture detail "${detailId}" belongs to another texture.`,
          path: foreignRemovalId
            ? 'payload.removeIds'
            : 'payload.upsert',
          expected: `detail owned by texture "${texture.id}"`
        }
      };
    }

    const existingIds = projectTextureDetailIds(document);
    const changedNodeIds = new Set<string>();
    const changedDetailIds = new Set<string>();
    const upsertIdSet = new Set(upsertIds);
    let next = document;
    for (const detailId of removeIds) {
      if (upsertIdSet.has(detailId)) continue;
      const owner = owners.get(detailId);
      if (!owner) continue;
      if (owner.kind === 'surface') changedNodeIds.add(owner.nodeId);
      next = removeOwnedDetail(next, detailId, owner);
    }

    for (const input of upsert) {
      const owner = owners.get(input.id);
      if (inputMatchesOwner(input, owner)) continue;
      changedDetailIds.add(input.id);
      const replaceInPlace = owner
        ? sameAnchor(input, owner)
        : false;
      if (owner?.kind === 'surface') changedNodeIds.add(owner.nodeId);
      if (owner && !replaceInPlace) {
        next = removeOwnedDetail(next, input.id, owner);
      }
      if (input.anchor.kind === 'surface') {
        changedNodeIds.add(input.anchor.nodeId);
        next = writeSurfaceDetail(next, input, replaceInPlace);
      } else {
        next = writeCanvasDetail(
          next,
          texture.id,
          input,
          replaceInPlace
        );
      }
    }

    const target = next.textures[payload.textureId];
    if (
      payload.background !== undefined &&
      target.raster &&
      !sameColor(payload.background, target.raster.background)
    ) {
      next = {
        ...next,
        textures: {
          ...next.textures,
          [target.id]: {
            ...target,
            raster: {
              ...target.raster,
              background: payload.background
            },
            metadata: {
              ...target.metadata,
              previewColor: payload.background
            }
          }
        }
      };
    }

    const oversizedFace = [...changedNodeIds].find((nodeId) => {
      const node = next.scene.nodes[nodeId];
      return (
        node.kind === 'cube' &&
        CUBE_FACE_DIRECTIONS.some(
          (direction) => node.faces[direction].details.length > 512
        )
      );
    });
    if (
      oversizedFace ||
      (next.textures[payload.textureId].raster?.canvasDetails.length ?? 0) >
        512
    ) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: 'A texture surface or canvas cannot exceed 512 details.',
          path: 'payload.upsert'
        }
      };
    }
    if (projectTextureDetailCount(next) > MAX_PROJECT_TEXTURE_DETAILS) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message:
            `A project cannot exceed ${MAX_PROJECT_TEXTURE_DETAILS} ` +
            'texture details.',
          path: 'payload.upsert'
        }
      };
    }
    const createdIds = [...changedDetailIds].filter(
      (id) => !existingIds.has(id)
    );
    const removedIds = removeIds.filter(
      (id) => existingIds.has(id) && !upsertIds.includes(id)
    );
    const changedExistingIds = [...changedDetailIds].filter(
      (id) => existingIds.has(id)
    );
    const changed = next !== document;
    return {
      ok: true,
      value: {
        document: next,
        summary: `Update ${texture.name} texture details`,
        effects: {
          createdEntityIds: createdIds,
          changedEntityIds: changed
            ? [
                texture.id,
                ...changedNodeIds,
                ...changedExistingIds
              ]
            : [],
          removedEntityIds: removedIds,
          invalidated: changed
            ? ['scene', 'textures', 'validation', 'preview']
            : []
        }
      }
    };
  }
});
