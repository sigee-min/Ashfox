import { addSceneNode } from '../../scene';
import { defineCommand } from '../definition';
import { entityIdsSchema, vec3Schema } from './schemas';
import {
  cloneCube,
  findMissingNodeId,
  findNonCube
} from './sceneHelpers';

const inputSchema = {
  type: 'object',
  properties: {
    nodeIds: entityIdsSchema,
    count: {
      type: 'number',
      minimum: 1,
      maximum: 64
    },
    step: vec3Schema,
    idPrefix: {
      type: 'string',
      minLength: 1
    }
  },
  required: ['nodeIds', 'count', 'step', 'idPrefix'],
  additionalProperties: false
} as const;

export const repeatCubesCommand = defineCommand({
  name: 'scene.cubes.repeat',
  label: 'Repeat cubes',
  purpose: 'Create a deterministic linear series from one or more cubes.',
  inputSchema,
  apply: (document, payload) => {
    const missingId = findMissingNodeId(document, payload.nodeIds);
    const nonCube = findNonCube(document, payload.nodeIds);
    if (missingId || nonCube || !Number.isInteger(payload.count)) {
      return {
        ok: false,
        error: {
          code: missingId || nonCube ? 'invalid_state' : 'invalid_payload',
          message: missingId
            ? `Scene node "${missingId}" does not exist.`
            : nonCube
              ? `Scene node "${nonCube.id}" is not a cube.`
              : 'Repeat count must be an integer.',
          path: missingId || nonCube ? 'payload.nodeIds' : 'payload.count'
        }
      };
    }

    const createdIds: string[] = [];
    let next = document;
    for (let copyIndex = 1; copyIndex <= payload.count; copyIndex += 1) {
      for (const sourceId of payload.nodeIds) {
        const id = `${payload.idPrefix}-${sourceId}-${copyIndex}`;
        if (next.scene.nodes[id]) {
          return {
            ok: false,
            error: {
              code: 'invalid_state',
              message: `Generated scene node ID "${id}" is already in use.`,
              path: 'payload.idPrefix'
            }
          };
        }
        const source = document.scene.nodes[sourceId];
        if (source.kind !== 'cube') continue;
        const offset: [number, number, number] = [
          payload.step[0] * copyIndex,
          payload.step[1] * copyIndex,
          payload.step[2] * copyIndex
        ];
        next = addSceneNode(
          next,
          cloneCube(source, id, `${source.name} ${copyIndex + 1}`, offset)
        );
        createdIds.push(id);
      }
    }
    return {
      ok: true,
      value: {
        document: next,
        summary: `Repeat ${payload.nodeIds.length} cube${payload.nodeIds.length === 1 ? '' : 's'} × ${payload.count}`,
        effects: {
          createdEntityIds: createdIds,
          changedEntityIds: [],
          removedEntityIds: [],
          invalidated: ['scene', 'uv', 'validation', 'preview']
        }
      }
    };
  }
});
