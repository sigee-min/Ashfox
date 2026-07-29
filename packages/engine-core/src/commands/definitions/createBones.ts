import {
  IDENTITY_TRANSFORM,
  type BoneNode,
  type ProjectDocument
} from '../../model';
import { addSceneNode } from '../../scene';
import { defineCommand } from '../definition';
import {
  nullableEntityIdSchema,
  partialTransformSchema
} from './schemas';
import type { BoneCreateInput } from '../types';

const boneSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      minLength: 1
    },
    name: {
      type: 'string',
      minLength: 1
    },
    parentId: nullableEntityIdSchema,
    transform: partialTransformSchema
  },
  required: ['id', 'name', 'parentId'],
  additionalProperties: false
} as const;

const inputSchema = {
  type: 'object',
  properties: {
    bones: {
      type: 'array',
      items: boneSchema,
      minItems: 1,
      maxItems: 128
    }
  },
  required: ['bones'],
  additionalProperties: false
} as const;

const createBone = (input: BoneCreateInput): BoneNode => ({
  id: input.id,
  kind: 'bone',
  name: input.name,
  parentId: input.parentId,
  transform: {
    ...IDENTITY_TRANSFORM,
    ...input.transform
  },
  visible: true
});

const addBone = (
  document: ProjectDocument,
  input: BoneCreateInput
): ProjectDocument => {
  const next = addSceneNode(document, createBone(input));
  if (input.parentId !== null) return next;
  return {
    ...next,
    scene: {
      ...next.scene,
      roots: [...next.scene.roots, input.id]
    }
  };
};

export const createBonesCommand = defineCommand({
  name: 'scene.bones.create',
  label: 'Create bones',
  purpose: 'Create one or more animation-ready scene bones.',
  inputSchema,
  apply: (document, payload) => {
    const ids = payload.bones.map((bone) => bone.id);
    const duplicateId = ids.find(
      (id, index) =>
        ids.indexOf(id) !== index || document.scene.nodes[id] !== undefined
    );
    const invalidParent = payload.bones.find(
      (bone) =>
        bone.parentId !== null &&
        document.scene.nodes[bone.parentId]?.kind !== 'bone'
    );
    if (duplicateId || invalidParent) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: duplicateId
            ? `Scene node ID "${duplicateId}" is already in use.`
            : 'Bone parent must reference an existing bone.',
          path: duplicateId
            ? 'payload.bones'
            : `payload.bones.${invalidParent?.id}.parentId`,
          expected: duplicateId ? undefined : 'existing bone ID or null'
        }
      };
    }

    const next = payload.bones.reduce(addBone, document);
    return {
      ok: true,
      value: {
        document: next,
        summary:
          payload.bones.length === 1
            ? `Create ${payload.bones[0].name}`
            : `Create ${payload.bones.length} bones`,
        effects: {
          createdEntityIds: ids,
          changedEntityIds: [],
          removedEntityIds: [],
          invalidated: ['scene', 'animations', 'validation', 'preview']
        }
      }
    };
  }
});
