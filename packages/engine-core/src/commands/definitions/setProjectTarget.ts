import type {
  AnimationClip,
  ProjectDocument,
  ProjectFormatProfile
} from '../../model';
import { resourceToken } from '../../resourceToken';
import {
  createMinecraftTextureBinding
} from '../../textures/createTextureAsset';
import { defineCommand } from '../definition';
import type { ExportPreset } from '../types';

const MINECRAFT_ANIMATION_NAME = /^animation\.[a-z0-9_.-]+$/;

const inputSchema = {
  type: 'object',
  properties: {
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
    }
  },
  required: ['target', 'namespace', 'modelPath'],
  additionalProperties: false
} as const;

const profileFor = (
  target: ExportPreset,
  namespace: string,
  modelPath: string
): ProjectFormatProfile => {
  switch (target) {
    case 'gltf':
      return {
        id: 'gltf.2',
        version: '2.0',
        container: 'gltf',
        imageStorage: 'external',
        modelPath
      };
    case 'glb':
      return {
        id: 'gltf.2',
        version: '2.0',
        container: 'glb',
        imageStorage: 'embedded',
        modelPath
      };
    case 'bedrock':
      return {
        id: 'minecraft.bedrock',
        version: '1.21.0',
        animationFormatVersion: '1.8.0',
        namespace,
        modelPath,
        animationPath: modelPath,
        geometryKind: 'entity',
        geometryIdentifier: `geometry.${modelPath.split('/').join('.')}`
      };
    case 'geckolib5':
      return {
        id: 'minecraft.java.geckolib5',
        version: '5',
        minecraftVersion: '1.21.1',
        geometryFormatVersion: '1.21.0',
        animationFormatVersion: '1.8.0',
        namespace,
        assetKind: 'entity',
        modelPath,
        animationPath: modelPath,
        geometryIdentifier: `geometry.${modelPath.split('/').join('.')}`
      };
  }
};

const actorAnimationName = (
  clip: AnimationClip,
  modelPath: string,
  usedNames: ReadonlySet<string>
): string => {
  if (
    MINECRAFT_ANIMATION_NAME.test(clip.name) &&
    !usedNames.has(clip.name)
  ) {
    return clip.name;
  }
  const prefix =
    `animation.${resourceToken(modelPath.split('/').join('.'), 'model')}`;
  const preferred = `${prefix}.${resourceToken(clip.name, 'clip')}`;
  return usedNames.has(preferred)
    ? `${preferred}.${resourceToken(clip.id, 'clip')}`
    : preferred;
};

const withoutImplicitRestPose = (
  animations: ProjectDocument['animations']
): ProjectDocument['animations'] =>
  Object.fromEntries(
    Object.entries(animations).filter(([id, clip]) =>
      id !== 'animation-rest-pose' ||
      Object.keys(clip.channels).length > 0 ||
      Object.keys(clip.triggers).length > 0
    )
  );

const animationsFor = (
  document: ProjectDocument,
  target: ExportPreset,
  modelPath: string
): ProjectDocument['animations'] => {
  const sourceAnimations = target === 'geckolib5'
    ? document.animations
    : withoutImplicitRestPose(document.animations);
  if (target !== 'bedrock' && target !== 'geckolib5') {
    return sourceAnimations;
  }
  const animations =
    target === 'geckolib5' &&
    Object.keys(sourceAnimations).length === 0
      ? {
          'animation-rest-pose': {
            id: 'animation-rest-pose',
            name: 'Rest pose',
            durationSeconds: 1,
            fps: 20,
            loop: 'loop' as const,
            channels: {},
            triggers: {}
          }
        }
      : sourceAnimations;
  const usedNames = new Set<string>();
  return Object.fromEntries(
    Object.entries(animations).map(([id, clip]) => {
      const name = actorAnimationName(clip, modelPath, usedNames);
      usedNames.add(name);
      return [id, name === clip.name ? clip : { ...clip, name }];
    })
  );
};

const texturesFor = (
  document: ProjectDocument,
  target: ExportPreset,
  namespace: string,
  modelPath: string
): ProjectDocument['textures'] => {
  if (
    target !== 'bedrock' &&
    target !== 'geckolib5'
  ) {
    return document.textures;
  }
  const textures = Object.entries(document.textures)
    .sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(
    textures.map(([id, texture], index) => [
      id,
      {
        ...texture,
        minecraft: {
          ...createMinecraftTextureBinding(
            {
              namespace,
              kind: 'entity',
              modelPath
            },
            id,
            index
          )
        }
      }
    ])
  );
};

export const setProjectTargetCommand = defineCommand({
  name: 'project.target.set',
  label: 'Set export target',
  purpose: 'Select one canonical target preset and its resource location.',
  inputSchema,
  apply: (document, payload) => {
    const namespace = payload.namespace.trim();
    const modelPath = payload.modelPath.trim();
    const emptyField = namespace.length === 0
      ? 'namespace'
      : modelPath.length === 0
        ? 'modelPath'
        : null;
    if (emptyField) {
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message: `Project ${emptyField} cannot be empty.`,
          path: `payload.${emptyField}`,
          expected: 'non-empty text'
        }
      }
    }
    const animations = animationsFor(
      document,
      payload.target,
      modelPath
    );
    const createdAnimationIds = Object.keys(animations).filter(
      (id) => document.animations[id] === undefined
    );
    const removedAnimationIds = Object.keys(document.animations).filter(
      (id) => animations[id] === undefined
    );
    return {
      ok: true,
      value: {
        document: {
          ...document,
          formatProfile: profileFor(
            payload.target,
            namespace,
            modelPath
          ),
          animations,
          textures: texturesFor(
            document,
            payload.target,
            namespace,
            modelPath
          )
        },
        summary: `Set ${payload.target} export target`,
        effects: {
          createdEntityIds: createdAnimationIds,
          changedEntityIds: [document.id],
          removedEntityIds: removedAnimationIds,
          invalidated: [
            'textures',
            'animations',
            'validation',
            'preview'
          ]
        }
      }
    };
  }
});
