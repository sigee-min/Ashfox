import { addSceneNode } from '../../scene';
import { defineCommand } from '../definition';
import { vec3Schema } from './schemas';
import { cloneCube } from './sceneHelpers';

const inputSchema = {
  type: 'object',
  properties: {
    copies: {
      type: 'array',
      minItems: 1,
      maxItems: 128,
      items: {
        type: 'object',
        properties: {
          sourceId: { type: 'string', minLength: 1 },
          id: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          offset: vec3Schema
        },
        required: ['sourceId', 'id'],
        additionalProperties: false
      }
    }
  },
  required: ['copies'],
  additionalProperties: false
} as const;

export const duplicateCubesCommand = defineCommand({
  name: 'scene.cubes.duplicate',
  label: 'Duplicate cubes',
  purpose: 'Create stable-ID copies of existing cubes with optional offsets.',
  inputSchema,
  apply: (document, payload) => {
    const ids = payload.copies.map((copy) => copy.id);
    const duplicateId = ids.find(
      (id, index) =>
        ids.indexOf(id) !== index || document.scene.nodes[id] !== undefined
    );
    if (duplicateId) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: `Scene node ID "${duplicateId}" is already in use.`,
          path: 'payload.copies'
        }
      };
    }
    const invalidSource = payload.copies.find(
      (copy) => document.scene.nodes[copy.sourceId]?.kind !== 'cube'
    );
    if (invalidSource) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: `Source "${invalidSource.sourceId}" is not a cube.`,
          path: 'payload.copies'
        }
      };
    }

    const clones = payload.copies.map((copy) => {
      const source = document.scene.nodes[copy.sourceId];
      if (source.kind !== 'cube') {
        throw new Error('Cube source changed during a synchronous command.');
      }
      return cloneCube(
        source,
        copy.id,
        copy.name ?? `${source.name} copy`,
        copy.offset ?? [0, 0, 0]
      );
    });
    const next = clones.reduce(addSceneNode, document);
    return {
      ok: true,
      value: {
        document: next,
        summary: `Duplicate ${payload.copies.length} cube${payload.copies.length === 1 ? '' : 's'}`,
        effects: {
          createdEntityIds: ids,
          changedEntityIds: [],
          removedEntityIds: [],
          invalidated: [
            'scene',
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
