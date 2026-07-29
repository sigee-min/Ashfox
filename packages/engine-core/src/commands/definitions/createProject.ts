import { createProjectDocument } from '../../project/createProjectDocument';
import type { ProjectDocument } from '../../model';
import { defineCommand } from '../definition';
import type { ProjectCreateInput } from '../types';
import { PROJECT_TEXTURE_RESOLUTIONS } from '../projectTextureResolution';
import { setProjectTargetCommand } from './setProjectTarget';

const inputSchema = {
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
    target: {
      enum: ['gltf', 'glb', 'bedrock', 'geckolib5']
    },
    namespace: {
      type: 'string',
      minLength: 1
    },
    modelPath: {
      type: 'string',
      minLength: 1
    },
    textureResolution: {
      enum: PROJECT_TEXTURE_RESOLUTIONS
    },
    createdAt: {
      type: 'string',
      minLength: 1
    }
  },
  required: [
    'id',
    'name',
    'target',
    'namespace',
    'modelPath',
    'textureResolution',
    'createdAt'
  ],
  additionalProperties: false
} as const;

const applyDefinition = (
  document: ProjectDocument,
  definition: typeof setProjectTargetCommand,
  payload: unknown
): ProjectDocument => {
  const result = definition.apply(document, payload);
  if (!result.ok) throw new Error(result.error.message);
  return result.value.document;
};

const normalizeProjectInput = (
  input: ProjectCreateInput
): ProjectCreateInput => ({
  ...input,
  id: input.id.trim(),
  name: input.name.trim(),
  namespace: input.namespace.trim(),
  modelPath: input.modelPath.trim(),
  createdAt: input.createdAt.trim()
});

export const createProjectFromInput = (
  input: ProjectCreateInput,
  revision: string
): ProjectDocument => {
  const normalized = normalizeProjectInput(input);
  const document = createProjectDocument({
    id: normalized.id,
    name: normalized.name,
    revision,
    createdAt: normalized.createdAt,
    textureResolution: normalized.textureResolution
  });
  return applyDefinition(
    document,
    setProjectTargetCommand,
    {
      target: normalized.target,
      namespace: normalized.namespace,
      modelPath: normalized.modelPath
    }
  );
};

export const createProjectCommand = defineCommand({
  name: 'project.create',
  label: 'Create project',
  purpose: 'Start one empty project with a canonical export target.',
  inputSchema,
  apply: (document, payload) => {
    const normalized = normalizeProjectInput(payload);
    const emptyField = (
      ['id', 'name', 'namespace', 'modelPath', 'createdAt'] as const
    ).find((field) => normalized[field].length === 0);
    if (emptyField) {
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message: `Project ${emptyField} cannot be empty.`,
          path: `payload.${emptyField}`,
          expected: 'non-empty text'
        }
      };
    }
    if (normalized.id === document.id) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message: 'A new project must use a new project ID.',
          path: 'payload.id',
          expected: 'project ID different from the active project'
        }
      };
    }
    if (!Number.isFinite(Date.parse(normalized.createdAt))) {
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message: 'Project creation timestamp must be valid ISO date text.',
          path: 'payload.createdAt',
          expected: 'ISO 8601 timestamp'
        }
      };
    }
    const next = createProjectFromInput(normalized, document.revision);
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
