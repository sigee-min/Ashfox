import { JsonSchema } from './types';
import {
  ENTITY_FORMATS,
  ENSURE_PROJECT_MATCHES,
  ENSURE_PROJECT_ON_MISMATCH,
  ENSURE_PROJECT_ON_MISSING,
  FORMAT_KINDS,
  GECKOLIB_TARGET_VERSIONS,
  PREVIEW_MODES,
  PREVIEW_OUTPUTS,
  PROJECT_STATE_DETAILS
} from '../shared/toolConstants';
import {
  BLOCK_PIPELINE_MODES,
  BLOCK_PIPELINE_ON_CONFLICT,
  BLOCK_VARIANTS
} from '../types/blockPipeline';
import { cubeFaceSchema, emptyObject, metaProps, numberArray, stateProps } from './schemas/common';
import { entityAnimationSchema } from './schemas/entity';
import { faceUvSchema, modelSpecSchema } from './schemas/model';
import { textureOpSchema, texturePresetSchema, uvPaintSchema } from './schemas/texture';

export const toolSchemas: Record<string, JsonSchema> = {
  list_capabilities: emptyObject,
  get_project_state: {
    type: 'object',
    additionalProperties: false,
    properties: {
      detail: { type: 'string', enum: PROJECT_STATE_DETAILS }
    }
  },
  read_texture: {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      saveToTmp: { type: 'boolean' },
      tmpName: { type: 'string' },
      tmpPrefix: { type: 'string' }
    }
  },
  reload_plugins: {
    type: 'object',
    required: ['confirm'],
    additionalProperties: false,
    properties: {
      confirm: { type: 'boolean' },
      delayMs: { type: 'number' }
    }
  },
  generate_texture_preset: {
    type: 'object',
    required: ['preset', 'width', 'height', 'uvUsageId'],
    additionalProperties: false,
    properties: {
      preset: texturePresetSchema,
      width: { type: 'number' },
      height: { type: 'number' },
      uvUsageId: { type: 'string' },
      name: { type: 'string' },
      targetId: { type: 'string' },
      targetName: { type: 'string' },
      mode: { type: 'string', enum: ['create', 'update'] },
      seed: { type: 'number' },
      palette: { type: 'array', items: { type: 'string' } },
      uvPaint: uvPaintSchema,
      ifRevision: { type: 'string' },
      ...metaProps
    }
  },
  auto_uv_atlas: {
    type: 'object',
    additionalProperties: false,
    properties: {
      padding: { type: 'number' },
      apply: { type: 'boolean' },
      ifRevision: { type: 'string' },
      ...metaProps
    }
  },
  ensure_project: {
    type: 'object',
    additionalProperties: false,
    properties: {
      format: { type: 'string', enum: FORMAT_KINDS },
      name: { type: 'string' },
      match: { type: 'string', enum: ENSURE_PROJECT_MATCHES },
      onMismatch: { type: 'string', enum: ENSURE_PROJECT_ON_MISMATCH },
      onMissing: { type: 'string', enum: ENSURE_PROJECT_ON_MISSING },
      confirmDiscard: { type: 'boolean' },
      confirmDialog: { type: 'boolean' },
      dialog: { type: 'object', additionalProperties: true },
      ifRevision: { type: 'string' },
      ...metaProps
    }
  },
  generate_block_pipeline: {
    type: 'object',
    required: ['name', 'texture'],
    additionalProperties: false,
    properties: {
      name: { type: 'string' },
      texture: { type: 'string' },
      namespace: { type: 'string' },
      variants: {
        type: 'array',
        minItems: 1,
        items: { type: 'string', enum: BLOCK_VARIANTS }
      },
      textures: {
        type: 'object',
        additionalProperties: false,
        properties: {
          top: { type: 'string' },
          side: { type: 'string' },
          bottom: { type: 'string' }
        }
      },
      onConflict: { type: 'string', enum: BLOCK_PIPELINE_ON_CONFLICT },
      mode: { type: 'string', enum: BLOCK_PIPELINE_MODES },
      ifRevision: { type: 'string' }
    }
  },
  set_project_texture_resolution: {
    type: 'object',
    required: ['width', 'height'],
    additionalProperties: false,
    properties: {
      width: { type: 'number' },
      height: { type: 'number' },
      modifyUv: { type: 'boolean' },
      ifRevision: { type: 'string' },
      ...metaProps
    }
  },
  preflight_texture: {
    type: 'object',
    additionalProperties: false,
    properties: {
      textureId: { type: 'string' },
      textureName: { type: 'string' },
      includeUsage: { type: 'boolean' }
    }
  },
  delete_texture: {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      ifRevision: { type: 'string' },
      ...metaProps
    }
  },
  assign_texture: {
    type: 'object',
    additionalProperties: false,
    properties: {
      textureId: { type: 'string' },
      textureName: { type: 'string' },
      cubeIds: { type: 'array', items: { type: 'string' } },
      cubeNames: { type: 'array', items: { type: 'string' } },
      faces: { type: 'array', minItems: 1, items: cubeFaceSchema },
      ifRevision: { type: 'string' },
      ...metaProps
    }
  },
  set_face_uv: {
    type: 'object',
    required: ['faces'],
    additionalProperties: false,
    properties: {
      cubeId: { type: 'string' },
      cubeName: { type: 'string' },
      faces: faceUvSchema,
      ifRevision: { type: 'string' },
      ...metaProps
    }
  },
  add_bone: {
    type: 'object',
    required: ['name', 'pivot'],
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      parent: { type: 'string' },
      parentId: { type: 'string' },
      pivot: numberArray(3, 3),
      rotation: numberArray(3, 3),
      scale: numberArray(3, 3),
      ifRevision: { type: 'string' },
      ...metaProps
    }
  },
  update_bone: {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      newName: { type: 'string' },
      parent: { type: 'string' },
      parentId: { type: 'string' },
      parentRoot: { type: 'boolean' },
      pivot: numberArray(3, 3),
      rotation: numberArray(3, 3),
      scale: numberArray(3, 3),
      ifRevision: { type: 'string' },
      ...metaProps
    }
  },
  delete_bone: {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      ifRevision: { type: 'string' },
      ...metaProps
    }
  },
  add_cube: {
    type: 'object',
    required: ['name', 'from', 'to'],
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      from: numberArray(3, 3),
      to: numberArray(3, 3),
      bone: { type: 'string' },
      boneId: { type: 'string' },
      inflate: { type: 'number' },
      mirror: { type: 'boolean' },
      ifRevision: { type: 'string' },
      ...metaProps
    }
  },
  update_cube: {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      newName: { type: 'string' },
      bone: { type: 'string' },
      boneId: { type: 'string' },
      boneRoot: { type: 'boolean' },
      from: numberArray(3, 3),
      to: numberArray(3, 3),
      inflate: { type: 'number' },
      mirror: { type: 'boolean' },
      ifRevision: { type: 'string' },
      ...metaProps
    }
  },
  delete_cube: {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      ifRevision: { type: 'string' },
      ...metaProps
    }
  },
  apply_rig_template: {
    type: 'object',
    required: ['templateId'],
    additionalProperties: false,
    properties: {
      templateId: { type: 'string' },
      ifRevision: { type: 'string' },
      ...metaProps
    }
  },
  export: {
    type: 'object',
    required: ['format', 'destPath'],
    additionalProperties: false,
    properties: {
      format: { enum: ['java_block_item_json', 'gecko_geo_anim', 'animated_java'] },
      destPath: { type: 'string' },
      ...stateProps
    }
  },
  render_preview: {
    type: 'object',
    required: ['mode'],
    additionalProperties: false,
    properties: {
      mode: { enum: PREVIEW_MODES },
      angle: numberArray(2, 3),
      clip: { type: 'string' },
      timeSeconds: { type: 'number' },
      durationSeconds: { type: 'number' },
      fps: { type: 'number' },
      output: { enum: PREVIEW_OUTPUTS },
      saveToTmp: { type: 'boolean' },
      tmpName: { type: 'string' },
      tmpPrefix: { type: 'string' },
      ...stateProps
    }
  },
  validate: {
    type: 'object',
    additionalProperties: false,
    properties: {
      ...stateProps
    }
  },
  apply_model_spec: {
    type: 'object',
    required: ['model'],
    additionalProperties: false,
    properties: {
      model: modelSpecSchema,
      ifRevision: { type: 'string' },
      ...metaProps
    }
  },
  apply_texture_spec: {
    type: 'object',
    required: ['textures', 'uvUsageId'],
    additionalProperties: false,
    properties: {
      textures: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['width', 'height'],
          additionalProperties: false,
          properties: {
            mode: { type: 'string', enum: ['create', 'update'] },
            id: { type: 'string' },
            targetId: { type: 'string' },
            targetName: { type: 'string' },
            name: { type: 'string' },
            width: { type: 'number' },
            height: { type: 'number' },
            background: { type: 'string' },
            useExisting: { type: 'boolean' },
            uvPaint: uvPaintSchema,
            ops: {
              type: 'array',
              items: textureOpSchema
            }
          }
        }
      },
      uvUsageId: { type: 'string' },
      autoRecover: { type: 'boolean' },
      ifRevision: { type: 'string' },
      ...metaProps
    }
  },
  apply_uv_spec: {
    type: 'object',
    required: ['assignments', 'uvUsageId'],
    additionalProperties: false,
    properties: {
      assignments: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['faces'],
          additionalProperties: false,
          properties: {
            cubeId: { type: 'string' },
            cubeName: { type: 'string' },
            cubeIds: { type: 'array', minItems: 1, items: { type: 'string' } },
            cubeNames: { type: 'array', minItems: 1, items: { type: 'string' } },
            faces: faceUvSchema
          }
        }
      },
      uvUsageId: { type: 'string' },
      ifRevision: { type: 'string' },
      ...metaProps
    }
  },
  texture_pipeline: {
    type: 'object',
    additionalProperties: false,
    properties: {
      assign: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            textureId: { type: 'string' },
            textureName: { type: 'string' },
            cubeIds: { type: 'array', minItems: 1, items: { type: 'string' } },
            cubeNames: { type: 'array', minItems: 1, items: { type: 'string' } },
            faces: { type: 'array', minItems: 1, items: cubeFaceSchema }
          }
        }
      },
      uv: {
        type: 'object',
        required: ['assignments'],
        additionalProperties: false,
        properties: {
          assignments: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['faces'],
              additionalProperties: false,
              properties: {
                cubeId: { type: 'string' },
                cubeName: { type: 'string' },
                cubeIds: { type: 'array', minItems: 1, items: { type: 'string' } },
                cubeNames: { type: 'array', minItems: 1, items: { type: 'string' } },
                faces: faceUvSchema
              }
            }
          }
        }
      },
      textures: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['width', 'height'],
          additionalProperties: false,
          properties: {
            mode: { type: 'string', enum: ['create', 'update'] },
            id: { type: 'string' },
            targetId: { type: 'string' },
            targetName: { type: 'string' },
            name: { type: 'string' },
            width: { type: 'number' },
            height: { type: 'number' },
            background: { type: 'string' },
            useExisting: { type: 'boolean' },
            uvPaint: uvPaintSchema,
            ops: {
              type: 'array',
              items: textureOpSchema
            }
          }
        }
      },
      presets: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['preset', 'width', 'height'],
          additionalProperties: false,
          properties: {
            preset: texturePresetSchema,
            width: { type: 'number' },
            height: { type: 'number' },
            name: { type: 'string' },
            targetId: { type: 'string' },
            targetName: { type: 'string' },
            mode: { type: 'string', enum: ['create', 'update'] },
            seed: { type: 'number' },
            palette: { type: 'array', items: { type: 'string' } },
            uvPaint: uvPaintSchema
          }
        }
      },
      autoRecover: { type: 'boolean' },
      preflight: {
        type: 'object',
        additionalProperties: false,
        properties: {
          includeUsage: { type: 'boolean' }
        }
      },
      preview: {
        type: 'object',
        additionalProperties: false,
        properties: {
          mode: { enum: PREVIEW_MODES },
          angle: numberArray(2, 3),
          clip: { type: 'string' },
          timeSeconds: { type: 'number' },
          durationSeconds: { type: 'number' },
          fps: { type: 'number' },
          output: { enum: PREVIEW_OUTPUTS },
          saveToTmp: { type: 'boolean' },
          tmpName: { type: 'string' },
          tmpPrefix: { type: 'string' }
        }
      },
      ifRevision: { type: 'string' },
      ...metaProps
    }
  },
  apply_entity_spec: {
    type: 'object',
    required: ['format'],
    additionalProperties: false,
    properties: {
      format: { type: 'string', enum: ENTITY_FORMATS },
      targetVersion: { type: 'string', enum: GECKOLIB_TARGET_VERSIONS },
      ensureProject: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          match: { type: 'string', enum: ENSURE_PROJECT_MATCHES },
          onMismatch: { type: 'string', enum: ENSURE_PROJECT_ON_MISMATCH },
          onMissing: { type: 'string', enum: ENSURE_PROJECT_ON_MISSING },
          confirmDiscard: { type: 'boolean' },
          confirmDialog: { type: 'boolean' },
          dialog: { type: 'object', additionalProperties: true }
        }
      },
      model: modelSpecSchema,
      textures: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['width', 'height'],
          additionalProperties: false,
          properties: {
            mode: { type: 'string', enum: ['create', 'update'] },
            id: { type: 'string' },
            targetId: { type: 'string' },
            targetName: { type: 'string' },
            name: { type: 'string' },
            width: { type: 'number' },
            height: { type: 'number' },
            background: { type: 'string' },
            useExisting: { type: 'boolean' },
            uvPaint: uvPaintSchema,
            ops: {
              type: 'array',
              items: textureOpSchema
            }
          }
        }
      },
      uvUsageId: { type: 'string' },
      autoRecover: { type: 'boolean' },
      animations: {
        type: 'array',
        items: entityAnimationSchema
      },
      ifRevision: { type: 'string' },
      ...metaProps
    }
  }
};
