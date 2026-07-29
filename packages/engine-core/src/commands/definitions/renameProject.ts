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
  apply: (document, payload) => ({
    ok: true,
    value: {
      document: document.name === payload.name
        ? document
        : {
            ...document,
            name: payload.name
          },
      summary: `Rename project to ${payload.name}`,
      effects: {
        createdEntityIds: [],
        changedEntityIds: [document.id],
        removedEntityIds: [],
        invalidated: ['validation', 'preview']
      }
    }
  })
});
