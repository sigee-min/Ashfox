import {
  ApplyEntitySpecPayload,
  ApplyModelSpecPayload,
  ApplyTextureSpecPayload,
  ApplyUvSpecPayload,
  TexturePipelinePayload
} from '../spec';
import { Limits, ToolResponse } from '../types';
import { buildRigTemplate } from '../templates';
import { isZeroSize } from '../domain/geometry';
import { errFromDomain, errWithCode } from './response';
import { validateTextureSpecs } from '../domain/textureSpecValidation';
import { validateUvAssignments } from '../domain/uvAssignments';
import { checkDimensions } from '../domain/dimensions';

export const validateModelSpec = (payload: ApplyModelSpecPayload, limits: Limits): ToolResponse<unknown> => {
  if (!payload.model) return errWithCode('invalid_payload', 'model is required');
  const inputParts = payload.model.parts ?? [];
  if (!Array.isArray(inputParts)) return errWithCode('invalid_payload', 'parts must be an array');
  const rigTemplate = payload.model.rigTemplate ?? 'empty';
  if (!['empty', 'biped', 'quadruped', 'block_entity'].includes(rigTemplate)) {
    return errWithCode('invalid_payload', `unknown rigTemplate: ${rigTemplate}`);
  }
  const templatedParts = buildRigTemplate(rigTemplate, inputParts);
  const cubeCount = templatedParts.filter((part) => !isZeroSize(part.size)).length;
  if (inputParts.length === 0 && templatedParts.length === 0) {
    return errWithCode(
      'invalid_payload',
      'parts or rigTemplate must provide parts (set model.rigTemplate or supply model.parts with id/size/offset).'
    );
  }
  if (cubeCount > limits.maxCubes) return errWithCode('invalid_payload', `too many parts (>${limits.maxCubes})`);
  const ids = new Set<string>();
  for (const p of inputParts) {
    if (!p.id) return errWithCode('invalid_payload', 'part id required');
    if (ids.has(p.id)) return errWithCode('invalid_payload', `duplicate part id: ${p.id}`);
    ids.add(p.id);
    if (!Array.isArray(p.size) || p.size.length !== 3) {
      return errWithCode('invalid_payload', `size invalid for ${p.id}`);
    }
    if (!Array.isArray(p.offset) || p.offset.length !== 3) {
      return errWithCode('invalid_payload', `offset invalid for ${p.id}`);
    }
  }
  for (const p of templatedParts) {
    if (!Array.isArray(p.size) || p.size.length !== 3) {
      return errWithCode('invalid_payload', `size invalid for ${p.id}`);
    }
    if (!Array.isArray(p.offset) || p.offset.length !== 3) {
      return errWithCode('invalid_payload', `offset invalid for ${p.id}`);
    }
  }
  return { ok: true, data: { valid: true } };
};

export const validateTextureSpec = (payload: ApplyTextureSpecPayload, limits: Limits): ToolResponse<unknown> => {
  const textureRes = validateTextureSpecs(payload.textures, limits);
  if (!textureRes.ok) return errFromDomain(textureRes.error);
  return { ok: true, data: { valid: true } };
};

export const validateUvSpec = (payload: ApplyUvSpecPayload): ToolResponse<unknown> => {
  if (!payload || typeof payload !== 'object') return errWithCode('invalid_payload', 'payload is required');
  const assignmentsRes = validateUvAssignments(payload.assignments);
  if (!assignmentsRes.ok) return errFromDomain(assignmentsRes.error);
  return { ok: true, data: { valid: true } };
};

export const validateEntitySpec = (payload: ApplyEntitySpecPayload, limits: Limits): ToolResponse<unknown> => {
  if (!payload || typeof payload !== 'object') return errWithCode('invalid_payload', 'payload is required');
  if (!payload.format) return errWithCode('invalid_payload', 'format is required');
  if (!['geckolib', 'modded_entity', 'optifine_entity'].includes(payload.format)) {
    return errWithCode('invalid_payload', `unsupported format: ${payload.format}`);
  }
  if (payload.targetVersion && !['v3', 'v4'].includes(payload.targetVersion)) {
    return errWithCode('invalid_payload', `unsupported targetVersion: ${payload.targetVersion}`);
  }
  if (payload.format !== 'geckolib' && payload.targetVersion) {
    return errWithCode('invalid_payload', 'targetVersion is only valid for geckolib format');
  }
  if (payload.model) {
    const modelRes = validateModelSpec({ model: payload.model }, limits);
    if (!modelRes.ok) return modelRes;
  }
  if (payload.textures) {
    const texRes = validateTextureSpec({ textures: payload.textures, uvUsageId: payload.uvUsageId ?? '' }, limits);
    if (!texRes.ok) return texRes;
  }
  if (payload.animations) {
    if (!Array.isArray(payload.animations)) return errWithCode('invalid_payload', 'animations must be an array');
    for (const anim of payload.animations) {
      if (!anim?.name) return errWithCode('invalid_payload', 'animation name is required');
      if (!Number.isFinite(anim.length) || anim.length <= 0) {
        return errWithCode('invalid_payload', `animation length must be > 0 (${anim.name})`);
      }
      if (typeof anim.loop !== 'boolean') {
        return errWithCode('invalid_payload', `animation loop must be boolean (${anim.name})`);
      }
      if (anim.fps !== undefined && (!Number.isFinite(anim.fps) || anim.fps <= 0)) {
        return errWithCode('invalid_payload', `animation fps must be > 0 (${anim.name})`);
      }
      if (anim.mode && !['create', 'update'].includes(anim.mode)) {
        return errWithCode('invalid_payload', `animation mode invalid (${anim.name})`);
      }
      if (anim.channels) {
        if (!Array.isArray(anim.channels)) {
          return errWithCode('invalid_payload', `channels must be array (${anim.name})`);
        }
        for (const channel of anim.channels) {
          if (!channel?.bone) return errWithCode('invalid_payload', `channel bone required (${anim.name})`);
          if (!['rot', 'pos', 'scale'].includes(channel.channel)) {
            return errWithCode('invalid_payload', `channel type invalid (${anim.name})`);
          }
          if (!Array.isArray(channel.keys)) {
            return errWithCode('invalid_payload', `channel keys must be array (${anim.name})`);
          }
          for (const key of channel.keys) {
            if (!Number.isFinite(key.time)) {
              return errWithCode('invalid_payload', `keyframe time invalid (${anim.name})`);
            }
            if (!Array.isArray(key.value) || key.value.length !== 3) {
              return errWithCode('invalid_payload', `keyframe value invalid (${anim.name})`);
            }
          }
        }
      }
      if (anim.triggers) {
        if (!Array.isArray(anim.triggers)) {
          return errWithCode('invalid_payload', `triggers must be array (${anim.name})`);
        }
        for (const trigger of anim.triggers) {
          if (!['sound', 'particle', 'timeline'].includes(trigger.type)) {
            return errWithCode('invalid_payload', `trigger type invalid (${anim.name})`);
          }
          if (!Array.isArray(trigger.keys)) {
            return errWithCode('invalid_payload', `trigger keys must be array (${anim.name})`);
          }
          for (const key of trigger.keys) {
            if (!Number.isFinite(key.time)) {
              return errWithCode('invalid_payload', `trigger time invalid (${anim.name})`);
            }
            if (!isTriggerValue(key.value)) {
              return errWithCode('invalid_payload', `trigger value invalid (${anim.name})`);
            }
          }
        }
      }
    }
  }
  return { ok: true, data: { valid: true } };
};

const TEXTURE_PRESET_NAMES = new Set<string>([
  'painted_metal',
  'rubber',
  'glass',
  'wood',
  'dirt',
  'plant',
  'stone',
  'sand',
  'leather',
  'fabric',
  'ceramic'
]);

export const validateTexturePipeline = (payload: TexturePipelinePayload, limits: Limits): ToolResponse<unknown> => {
  if (!payload || typeof payload !== 'object') return errWithCode('invalid_payload', 'payload is required');
  const hasStep = Boolean(
    (payload.assign && payload.assign.length > 0) ||
      payload.uv ||
      (payload.textures && payload.textures.length > 0) ||
      (payload.presets && payload.presets.length > 0) ||
      payload.preflight ||
      payload.preview
  );
  if (!hasStep) {
    return errWithCode(
      'invalid_payload',
      'texture_pipeline requires at least one step (assign, uv, textures, presets, preflight, preview).'
    );
  }

  if (payload.assign) {
    if (!Array.isArray(payload.assign)) return errWithCode('invalid_payload', 'assign must be an array');
    for (const entry of payload.assign) {
      if (!entry?.textureId && !entry?.textureName) {
        return errWithCode('invalid_payload', 'assign entry requires textureId or textureName');
      }
      if (entry.cubeIds && !Array.isArray(entry.cubeIds)) {
        return errWithCode('invalid_payload', 'assign cubeIds must be an array');
      }
      if (entry.cubeNames && !Array.isArray(entry.cubeNames)) {
        return errWithCode('invalid_payload', 'assign cubeNames must be an array');
      }
    }
  }

  if (payload.uv) {
    const assignmentsRes = validateUvAssignments(payload.uv.assignments);
    if (!assignmentsRes.ok) return errFromDomain(assignmentsRes.error);
  }

  if (payload.textures) {
    const textureRes = validateTextureSpecs(payload.textures, limits);
    if (!textureRes.ok) return errFromDomain(textureRes.error);
  }

  if (payload.presets) {
    if (!Array.isArray(payload.presets)) return errWithCode('invalid_payload', 'presets must be an array');
    for (const preset of payload.presets) {
      if (!preset?.preset || typeof preset.preset !== 'string') {
        return errWithCode('invalid_payload', 'preset name is required');
      }
      if (!TEXTURE_PRESET_NAMES.has(preset.preset)) {
        return errWithCode('invalid_payload', `unknown texture preset: ${preset.preset}`);
      }
      const width = Number(preset.width);
      const height = Number(preset.height);
      const dimCheck = checkDimensions(width, height, { requireInteger: true, maxSize: limits.maxTextureSize });
      if (!dimCheck.ok) {
        if (dimCheck.reason === 'non_positive') {
          return errWithCode('invalid_payload', 'preset width/height must be positive numbers');
        }
        if (dimCheck.reason === 'non_integer') {
          return errWithCode('invalid_payload', 'preset width/height must be integers');
        }
        return errWithCode('invalid_payload', `preset size exceeds max ${limits.maxTextureSize}`);
      }
      if (preset.mode && !['create', 'update'].includes(preset.mode)) {
        return errWithCode('invalid_payload', `preset mode invalid (${preset.preset})`);
      }
      if ((preset.mode ?? 'create') === 'update' && !preset.targetId && !preset.targetName) {
        return errWithCode('invalid_payload', `preset update requires targetId or targetName (${preset.preset})`);
      }
    }
  }

  if (payload.preview) {
    const mode = payload.preview.mode;
    if (mode && !['fixed', 'turntable'].includes(mode)) {
      return errWithCode('invalid_payload', `preview mode invalid (${mode})`);
    }
  }

  return { ok: true, data: { valid: true } };
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isTriggerValue = (value: unknown): boolean => {
  if (typeof value === 'string') return true;
  if (Array.isArray(value)) return value.every((item) => typeof item === 'string');
  return isRecord(value);
};
