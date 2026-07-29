import {
  IDENTITY_TRANSFORM,
  type LocatorNode,
  type ProjectDocument
} from '../../model';
import { addSceneNode } from '../../scene';
import { defineCommand } from '../definition';
import type { LocatorCreateInput } from '../types';
import {
  nullableEntityIdSchema,
  partialTransformSchema
} from './schemas';

const locatorSchema = {
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
    transform: partialTransformSchema,
    ignoreInheritedScale: {
      type: 'boolean'
    }
  },
  required: ['id', 'name', 'parentId'],
  additionalProperties: false
} as const;

const inputSchema = {
  type: 'object',
  properties: {
    locators: {
      type: 'array',
      items: locatorSchema,
      minItems: 1,
      maxItems: 128
    }
  },
  required: ['locators'],
  additionalProperties: false
} as const;

const createLocator = (
  input: LocatorCreateInput
): LocatorNode => ({
  id: input.id,
  kind: 'locator',
  name: input.name,
  parentId: input.parentId,
  transform: {
    ...IDENTITY_TRANSFORM,
    ...input.transform
  },
  visible: true,
  ...(input.ignoreInheritedScale === undefined
    ? {}
    : { ignoreInheritedScale: input.ignoreInheritedScale })
});

const addLocator = (
  document: ProjectDocument,
  input: LocatorCreateInput
): ProjectDocument => {
  const next = addSceneNode(document, createLocator(input));
  if (input.parentId !== null) return next;
  return {
    ...next,
    scene: {
      ...next.scene,
      roots: [...next.scene.roots, input.id]
    }
  };
};

export const createLocatorsCommand = defineCommand({
  name: 'scene.locators.create',
  label: 'Create locators',
  purpose:
    'Create attachment points for exported particle and sound events.',
  inputSchema,
  apply: (document, payload) => {
    const ids = payload.locators.map((locator) => locator.id);
    const duplicateId = ids.find(
      (id, index) =>
        ids.indexOf(id) !== index ||
        document.scene.nodes[id] !== undefined
    );
    const invalidParent = payload.locators.find(
      (locator) =>
        locator.parentId !== null &&
        document.scene.nodes[locator.parentId]?.kind !== 'bone'
    );
    if (duplicateId || invalidParent) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: duplicateId
            ? `Scene node ID "${duplicateId}" is already in use.`
            : 'Locator parent must reference an existing bone.',
          path: duplicateId
            ? 'payload.locators'
            : `payload.locators.${invalidParent?.id}.parentId`,
          expected: duplicateId
            ? undefined
            : 'existing bone ID or null'
        }
      };
    }
    const next = payload.locators.reduce(addLocator, document);
    return {
      ok: true,
      value: {
        document: next,
        summary:
          payload.locators.length === 1
            ? `Create ${payload.locators[0].name}`
            : `Create ${payload.locators.length} locators`,
        effects: {
          createdEntityIds: ids,
          changedEntityIds: [],
          removedEntityIds: [],
          invalidated: [
            'scene',
            'animations',
            'validation',
            'preview'
          ]
        }
      }
    };
  }
});
