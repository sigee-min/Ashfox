import type { Transform, Vec3 } from '../../model';
import { updateSceneNode } from '../../scene';
import {
  remapCubeSurfaces,
  surfaceDetailIds
} from '../../textures/surfaceDetails';
import { defineCommand } from '../definition';
import { axisSchema, entityIdsSchema } from './schemas';
import {
  axisIndex,
  findMissingNodeId,
  findNonCube
} from './sceneHelpers';
import type { SceneAxis } from '../types';

const inputSchema = {
  type: 'object',
  properties: {
    nodeIds: entityIdsSchema,
    axis: axisSchema
  },
  required: ['nodeIds', 'axis'],
  additionalProperties: false
} as const;

const mirrorPoint = (value: Vec3, axis: SceneAxis): Vec3 => {
  const index = axisIndex(axis);
  const next: [number, number, number] = [...value];
  next[index] *= -1;
  return next;
};

const mirrorRotation = (
  rotation: Vec3,
  axis: SceneAxis
): Vec3 => {
  const index = axisIndex(axis);
  return rotation.map(
    (value, valueIndex) => value * (valueIndex === index ? 1 : -1)
  ) as [number, number, number];
};

const mirrorTransform = (
  transform: Transform,
  axis: SceneAxis
): Transform => ({
  ...transform,
  position: mirrorPoint(transform.position, axis),
  pivot: mirrorPoint(transform.pivot, axis),
  rotation: mirrorRotation(transform.rotation, axis)
});

export const mirrorCubesCommand = defineCommand({
  name: 'scene.cubes.mirror',
  label: 'Mirror cubes',
  purpose: 'Mirror cube geometry and transforms across a model axis.',
  inputSchema,
  apply: (document, payload) => {
    const missingId = findMissingNodeId(document, payload.nodeIds);
    const nonCube = findNonCube(document, payload.nodeIds);
    if (missingId || nonCube) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: missingId
            ? `Scene node "${missingId}" does not exist.`
            : `Scene node "${nonCube?.id}" is not a cube.`,
          path: 'payload.nodeIds'
        }
      };
    }
    const preservedCubeId = payload.nodeIds.find((nodeId) => {
      const node = document.scene.nodes[nodeId];
      return (
        node.kind === 'cube' &&
        Object.values(node.faces).some(
          (face) =>
            face.enabled &&
            face.textureId !== null &&
            document.textures[face.textureId]?.atlasMode !== 'generate'
        )
      );
    });
    if (preservedCubeId) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message:
            `Cube "${preservedCubeId}" uses preserved UVs that cannot be ` +
            'mirrored consistently across every export target.',
          path: 'payload.nodeIds',
          expected:
            'cubes with generated textures or explicitly untextured faces'
        }
      };
    }
    const index = axisIndex(payload.axis);
    const next = payload.nodeIds.reduce(
      (current, nodeId) =>
        updateSceneNode(current, nodeId, (node) => {
          if (node.kind !== 'cube') return node;
          const from: [number, number, number] = [...node.bounds.from];
          const to: [number, number, number] = [...node.bounds.to];
          from[index] = -node.bounds.to[index];
          to[index] = -node.bounds.from[index];
          return {
            ...node,
            transform: mirrorTransform(node.transform, payload.axis),
            bounds: { from, to },
            faces: remapCubeSurfaces(node.faces, {
              kind: 'mirror',
              axis: payload.axis
            }).faces
          };
        }),
      document
    );
    return {
      ok: true,
      value: {
        document: next,
        summary: `Mirror ${payload.nodeIds.length} cube${payload.nodeIds.length === 1 ? '' : 's'} on ${payload.axis.toUpperCase()}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: [
            ...payload.nodeIds,
            ...payload.nodeIds.flatMap((nodeId) => {
              const node = document.scene.nodes[nodeId];
              return node.kind === 'cube'
                ? surfaceDetailIds(node.faces)
                : [];
            })
          ],
          removedEntityIds: [],
          invalidated: [
            'scene',
            'textures',
            'uv',
            'animations',
            'validation',
            'preview'
          ]
        }
      }
    };
  }
});
