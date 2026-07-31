import { defineCommand } from '../definition';
import {
  configureProjectTarget,
  exportPresetForDocument
} from './setProjectTarget';

const inputSchema = {
  type: 'object',
  properties: {
    namespace: {
      type: 'string',
      minLength: 1,
      maxLength: 128
    },
    modelPath: {
      type: 'string',
      minLength: 1,
      maxLength: 512
    }
  },
  required: ['namespace', 'modelPath'],
  additionalProperties: false
} as const;

export const setProjectResourceCommand = defineCommand({
  name: 'project.resource.set',
  label: 'Set project resource location',
  purpose:
    'Set the human-edited namespace and model path for the current target.',
  inputSchema,
  apply: (document, payload) => {
    const target = exportPresetForDocument(document);
    if (target === null) {
      return {
        ok: false,
        error: {
          code: 'invalid_state',
          message:
            'The current project target has no editable resource location.',
          path: 'formatProfile',
          expected:
            'gltf, glb, bedrock, or geckolib5 target'
        }
      };
    }
    return configureProjectTarget(
      document,
      target,
      payload.namespace.trim(),
      payload.modelPath.trim(),
      'Set project resource location'
    );
  }
});
