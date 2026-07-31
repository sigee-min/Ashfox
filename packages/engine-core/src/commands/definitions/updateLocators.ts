import type {
  LocatorNode,
  ProjectDocument
} from '../../model';
import {
  transformsEqual,
  updateSceneNode
} from '../../scene';
import { compareStableText } from '../../stableOrder';
import { defineCommand } from '../definition';
import type {
  LocatorUpdateInput
} from '../types';
import {
  nullableEntityIdSchema,
  partialTransformSchema
} from './schemas';

const locatorUpdateSchema = {
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
    visible: {
      type: 'boolean'
    },
    ignoreInheritedScale: {
      anyOf: [
        { type: 'boolean' },
        { enum: [null] }
      ]
    }
  },
  required: ['id'],
  additionalProperties: false
} as const;

const inputSchema = {
  type: 'object',
  properties: {
    locators: {
      type: 'array',
      items: locatorUpdateSchema,
      minItems: 1,
      maxItems: 128
    }
  },
  required: ['locators'],
  additionalProperties: false
} as const;

const updatedLocator = (
  current: LocatorNode,
  input: LocatorUpdateInput
): LocatorNode => {
  const transform = input.transform
    ? {
        ...current.transform,
        ...input.transform
      }
    : current.transform;
  const ignoreInheritedScale =
    input.ignoreInheritedScale === undefined
      ? current.ignoreInheritedScale
      : input.ignoreInheritedScale ?? undefined;
  const candidate: LocatorNode = {
    ...current,
    name: input.name?.trim() ?? current.name,
    parentId:
      input.parentId === undefined
        ? current.parentId
        : input.parentId,
    transform,
    visible:
      input.visible === undefined
        ? current.visible
        : input.visible,
    ...(ignoreInheritedScale === undefined
      ? {}
      : { ignoreInheritedScale })
  };
  if (ignoreInheritedScale === undefined) {
    delete candidate.ignoreInheritedScale;
  }
  return candidate;
};

const locatorsEqual = (
  left: LocatorNode,
  right: LocatorNode
): boolean =>
  left.name === right.name &&
  left.parentId === right.parentId &&
  left.visible === right.visible &&
  left.ignoreInheritedScale === right.ignoreInheritedScale &&
  transformsEqual(left.transform, right.transform);

const updateRootMembership = (
  document: ProjectDocument,
  changedIds: ReadonlySet<string>
): ProjectDocument => {
  const roots = [
    ...new Set([
      ...document.scene.roots.filter((nodeId) => {
        if (!changedIds.has(nodeId)) return true;
        return document.scene.nodes[nodeId]?.parentId === null;
      }),
      ...[...changedIds].filter(
        (nodeId) =>
          document.scene.nodes[nodeId]?.parentId === null
      )
    ])
  ].sort(compareStableText);
  return roots.length === document.scene.roots.length &&
    roots.every(
      (nodeId, index) => nodeId === document.scene.roots[index]
    )
    ? document
    : {
        ...document,
        scene: {
          ...document.scene,
          roots
        }
      };
};

export const updateLocatorsCommand = defineCommand({
  name: 'scene.locators.update',
  label: 'Update locators',
  purpose:
    'Rename, reparent, transform, show, hide, or configure existing attachment locators without exposing generated model nodes.',
  inputSchema,
  apply: (document, payload) => {
    const ids = payload.locators.map((locator) => locator.id);
    const duplicateId = ids.find(
      (id, index) => ids.indexOf(id) !== index
    );
    const invalidLocator = payload.locators.find(
      (input) =>
        document.scene.nodes[input.id]?.kind !== 'locator'
    );
    const invalidParent = payload.locators.find(
      (input) =>
        input.parentId !== undefined &&
        input.parentId !== null &&
        document.scene.nodes[input.parentId]?.kind !== 'bone'
    );
    const emptyName = payload.locators.find(
      (input) =>
        input.name !== undefined &&
        input.name.trim().length === 0
    );
    if (
      duplicateId ||
      invalidLocator ||
      invalidParent ||
      emptyName
    ) {
      return {
        ok: false,
        error: {
          code:
            duplicateId || emptyName
              ? 'invalid_payload'
              : 'invalid_state',
          message: duplicateId
            ? `Locator "${duplicateId}" is updated more than once.`
            : invalidLocator
              ? `Locator "${invalidLocator.id}" does not exist.`
              : invalidParent
                ? 'Locator parent must reference an existing bone.'
                : 'Locator name cannot be empty.',
          path: duplicateId || emptyName
            ? 'payload.locators'
            : invalidLocator
              ? `payload.locators.${invalidLocator.id}`
              : `payload.locators.${invalidParent?.id}.parentId`,
          expected:
            invalidParent
              ? 'existing bone ID or null'
              : undefined
        }
      };
    }

    let next = document;
    const changedIds = new Set<string>();
    for (const input of payload.locators) {
      next = updateSceneNode(next, input.id, (node) => {
        if (node.kind !== 'locator') return node;
        const candidate = updatedLocator(node, input);
        if (locatorsEqual(node, candidate)) return node;
        changedIds.add(node.id);
        return candidate;
      });
    }
    next = updateRootMembership(next, changedIds);
    return {
      ok: true,
      value: {
        document: next,
        summary:
          `Update ${payload.locators.length} locator` +
          `${payload.locators.length === 1 ? '' : 's'}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: [...changedIds].sort(compareStableText),
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
