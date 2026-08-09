import { createProjectDocument } from '../../project/create';
import type { ProjectDocument } from '../../model';
import { resourceToken } from '../../resourceToken';
import { defineCommand } from '../definition';
import type {
  ProjectCreateInput,
  ProjectDocumentCreateInput
} from '../types';
import type {
  CommandInputSchema
} from '../schema';

const inputSchema: CommandInputSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1
    },
    density: {
      enum: [1],
      description:
        'Iconic projects use the fixed 1-unit form grid. Surface character comes from flat texture clusters, not smaller geometry cells.'
    }
  },
  required: ['name'],
  additionalProperties: false
};

const normalizeProjectInput = (
  input: ProjectDocumentCreateInput
): ProjectDocumentCreateInput => ({
  ...input,
  id: input.id.trim(),
  name: input.name.trim(),
  createdAt: input.createdAt.trim()
});

export const createProjectFromInput = (
  input: ProjectDocumentCreateInput,
  revision: string
): ProjectDocument => {
  const normalized = normalizeProjectInput(input);
  const empty = createProjectDocument({
    id: normalized.id,
    name: normalized.name,
    revision,
    createdAt: normalized.createdAt
  });
  const document = normalized.density === undefined
    ? empty
    : {
        ...empty,
        settings: {
          ...empty.settings,
          surfacePixelDensity: normalized.density
        }
      };
  return document;
};

const stableProjectSuffix = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
};

const deriveProjectInput = (
  document: ProjectDocument,
  payload: ProjectCreateInput
): ProjectDocumentCreateInput => {
  const name = payload.name.trim();
  const density = payload.density ?? 1;
  const identitySeed = [
    document.id,
    document.revision,
    document.updatedAt,
    name
  ].join('\u0000');
  const candidateId =
    `project-${resourceToken(name, 'asset')}-` +
    stableProjectSuffix(identitySeed);
  return {
    id:
      candidateId === document.id
        ? `${candidateId}-next`
        : candidateId,
    name,
    createdAt: document.updatedAt,
    density
  };
};

export const createProjectCommand = defineCommand({
  name: 'project.create',
  label: 'Create project',
  purpose: 'Start one empty project with a target-independent canonical asset.',
  inputSchema,
  apply: (document, payload) => {
    const input = deriveProjectInput(document, payload);
    if (input.name.length === 0) {
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message: 'Project name cannot be empty.',
          path: 'payload.name',
          expected: 'non-empty text'
        }
      };
    }
    const next = createProjectFromInput(input, document.revision);
    return {
      ok: true,
      value: {
        document: next,
        summary: `Create ${next.name}`,
        effects: {
          createdEntityIds: [next.id],
          changedEntityIds: [],
          removedEntityIds: Object.keys(document.scene.nodes),
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
