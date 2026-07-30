import type { ProjectDocument } from '../model';
import { isCompiledPartNode } from '../modeling/provenance';
import type { ProjectCommandOperation } from './types';

export interface CompiledPartOperationIssue {
  path: string;
  message: string;
}

const compiledId = (
  document: ProjectDocument,
  ids: readonly string[]
): string | null =>
  ids.find((id) => {
    const node = document.scene.nodes[id];
    return node ? isCompiledPartNode(node) : false;
  }) ?? null;

const compiledParent = (
  document: ProjectDocument,
  parentId: string | null
): boolean => {
  if (parentId === null) return false;
  const parent = document.scene.nodes[parentId];
  return parent ? isCompiledPartNode(parent) : false;
};

const protectedTarget = (
  document: ProjectDocument,
  ids: readonly string[],
  path: string
): CompiledPartOperationIssue | null => {
  const id = compiledId(document, ids);
  return id
    ? {
        path,
        message:
          `Generated node "${id}" is owned by model.parts commands.`
      }
    : null;
};

export const validateCompiledPartOperation = (
  document: ProjectDocument,
  operation: ProjectCommandOperation
): CompiledPartOperationIssue | null => {
  switch (operation.name) {
    case 'scene.bones.create': {
      const bone = operation.payload.bones.find((entry) =>
        compiledParent(document, entry.parentId)
      );
      return bone
        ? {
            path: 'payload.bones',
            message:
              'Raw bones cannot be inserted into a compiled part hierarchy.'
          }
        : null;
    }
    case 'scene.cubes.create': {
      const cube = operation.payload.cubes.find((entry) =>
        compiledParent(document, entry.parentId)
      );
      return cube
        ? {
            path: 'payload.cubes',
            message:
              'Raw cubes cannot be inserted into a compiled part hierarchy.'
          }
        : null;
    }
    case 'scene.nodes.transform':
    case 'scene.nodes.visibility':
    case 'scene.nodes.delete':
    case 'scene.cubes.mirror':
    case 'scene.cubes.repeat':
    case 'scene.nodes.align':
    case 'scene.nodes.pivot':
    case 'scene.cubes.material':
      return protectedTarget(
        document,
        operation.payload.nodeIds,
        'payload.nodeIds'
      );
    case 'scene.cubes.geometry.update':
      return protectedTarget(
        document,
        operation.payload.updates.map((entry) => entry.nodeId),
        'payload.updates'
      );
    case 'scene.nodes.rename':
      return protectedTarget(
        document,
        operation.payload.renames.map((entry) => entry.nodeId),
        'payload.renames'
      );
    case 'scene.cubes.duplicate':
      return protectedTarget(
        document,
        operation.payload.copies.map((entry) => entry.sourceId),
        'payload.copies'
      );
    case 'scene.nodes.reparent': {
      const target = protectedTarget(
        document,
        operation.payload.nodeIds,
        'payload.nodeIds'
      );
      if (target) return target;
      return compiledParent(document, operation.payload.parentId)
        ? {
            path: 'payload.parentId',
            message:
              'Raw nodes cannot be reparented into a compiled part hierarchy.'
          }
        : null;
    }
    case 'animation.channels.upsert': {
      const geometryTarget = operation.payload.channels.find((channel) => {
        const node = document.scene.nodes[channel.targetNodeId];
        return (
          node?.generation?.authority === 'ashfox.part-compiler' &&
          node.generation.role === 'geometry'
        );
      });
      return geometryTarget
        ? {
            path: 'payload.channels',
            message:
              'Compiled geometry cannot be animated directly; target its stable part bone.'
          }
        : null;
    }
    default:
      return null;
  }
};
