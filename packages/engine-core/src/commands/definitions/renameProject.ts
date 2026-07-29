import { defineCommand } from '../definition';

const inputSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      minLength: 1
    }
  },
  required: ['name'],
  additionalProperties: false
} as const;

export const renameProjectCommand = defineCommand({
  name: 'project.rename',
  label: 'Rename project',
  purpose: 'Set the canonical project and export display name.',
  inputSchema,
  apply: (document, payload) => {
    const name = payload.name.trim();
    if (name.length === 0) {
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message: 'Project name cannot be empty.',
          path: 'payload.name',
          expected: 'non-empty text'
        }
      }
    }
    return {
      ok: true,
      value: {
        document: document.name === name
          ? document
          : {
              ...document,
              name
            },
        summary: `Rename project to ${name}`,
        effects: {
          createdEntityIds: [],
          changedEntityIds: [document.id],
          removedEntityIds: [],
          invalidated: ['validation', 'preview']
        }
      }
    };
  }
});
