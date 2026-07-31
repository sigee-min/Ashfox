import type {
  AnimationClip,
  ProjectDocument,
  ProjectFormatProfile
} from '../../model';
import { canonicalJsonString } from '../../canonicalJson';
import { resourceToken } from '../../resourceToken';
import {
  createMinecraftTextureBinding
} from '../../textures/createTextureAsset';
import {
  defineCommand,
  type CommandApplicationResult
} from '../definition';
import type {
  ExportPreset
} from '../types';

const MINECRAFT_ANIMATION_NAME = /^animation\.[a-z0-9_.-]+$/;
const MINECRAFT_NAMESPACE = /^[a-z0-9_.-]+$/;
const MINECRAFT_MODEL_PATH = /^[a-z0-9_./-]+$/;
const GLTF_MODEL_PATH = /^[A-Za-z0-9_./-]+$/;

const inputSchema = {
  type: 'object',
  properties: {
    target: {
      enum: ['gltf', 'glb', 'bedrock', 'geckolib5']
    }
  },
  required: ['target'],
  additionalProperties: false
} as const;

const currentNamespace = (
  document: ProjectDocument
): string =>
  document.formatProfile.id === 'minecraft.bedrock' ||
  document.formatProfile.id === 'minecraft.java.geckolib5' ||
  document.formatProfile.id === 'minecraft.java_block'
    ? document.formatProfile.namespace
    : 'ashfox';

const currentModelPath = (
  document: ProjectDocument
): string =>
  document.formatProfile.id === 'ashfox.generic'
    ? resourceToken(document.name, 'asset')
    : document.formatProfile.modelPath;

const targetInput = (
  document: ProjectDocument,
  target: ExportPreset
): {
  namespace: string;
  modelPath: string;
} => ({
  namespace:
    currentNamespace(document),
  modelPath:
    (
      target === 'bedrock' ||
      target === 'geckolib5'
        ? currentModelPath(document)
          .split('/')
          .map((segment) => resourceToken(segment, 'asset'))
          .join('/')
        : currentModelPath(document)
    )
});

const invalidModelPath = (
  target: ExportPreset,
  modelPath: string
): boolean => {
  const pattern =
    target === 'gltf' || target === 'glb'
      ? GLTF_MODEL_PATH
      : MINECRAFT_MODEL_PATH;
  return (
    !pattern.test(modelPath) ||
    modelPath.startsWith('/') ||
    modelPath.endsWith('/') ||
    modelPath.includes('..') ||
    (
      target === 'gltf' || target === 'glb'
        ? /\.(?:gltf|glb|bin)$/i.test(modelPath)
        : modelPath.endsWith('.json')
    )
  );
};

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

const animationsFor = (
  document: ProjectDocument,
  target: ExportPreset,
  modelPath: string
): ProjectDocument['animations'] => {
  if (target !== 'bedrock' && target !== 'geckolib5') {
    return document.animations;
  }
  const usedNames = new Set<string>();
  return Object.fromEntries(
    Object.entries(document.animations).map(([id, clip]) => {
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

export const configureProjectTarget = (
  document: ProjectDocument,
  target: ExportPreset,
  namespace: string,
  modelPath: string,
  summary = `Set ${target} export target`
): CommandApplicationResult => {
    const invalidNamespace =
      (
        target === 'bedrock' ||
        target === 'geckolib5'
      ) &&
      !MINECRAFT_NAMESPACE.test(namespace);
    if (
      invalidNamespace ||
      invalidModelPath(target, modelPath)
    ) {
      const path = invalidNamespace ? 'namespace' : 'modelPath';
      return {
        ok: false,
        error: {
          code: 'invalid_payload',
          message:
            invalidNamespace
              ? 'Project namespace is not a safe resource namespace.'
              : 'Project model path is not a safe extensionless relative path.',
          path: `payload.${path}`,
          expected:
            invalidNamespace
              ? 'lowercase letters, digits, dots, underscores, or hyphens'
              : 'safe relative resource path without traversal or file extension'
        }
      }
    }
    const animations = animationsFor(
      document,
      target,
      modelPath
    );
    const targetCandidate: ProjectDocument = {
      ...document,
      formatProfile: profileFor(
        target,
        namespace,
        modelPath
      ),
      animations,
      textures: texturesFor(
        document,
        target,
        namespace,
        modelPath
      )
    };
    const candidate = targetCandidate;
    const createdAnimationIds = Object.keys(
      candidate.animations
    ).filter(
      (id) => document.animations[id] === undefined
    );
    const removedAnimationIds = Object.keys(
      document.animations
    ).filter(
      (id) => candidate.animations[id] === undefined
    );
    const changed =
      canonicalJsonString(candidate) !==
      canonicalJsonString(document);
    return {
      ok: true,
      value: {
        document: changed ? candidate : document,
        summary,
        effects: {
          createdEntityIds:
            changed ? createdAnimationIds : [],
          changedEntityIds: changed ? [document.id] : [],
          removedEntityIds:
            changed ? removedAnimationIds : [],
          invalidated:
            changed
              ? [
                  'textures',
                  'animations',
                  'validation',
                  'preview'
                ]
              : []
        }
      }
    };
};

export const exportPresetForDocument = (
  document: ProjectDocument
): ExportPreset | null => {
  switch (document.formatProfile.id) {
    case 'gltf.2':
      return document.formatProfile.container;
    case 'minecraft.bedrock':
      return 'bedrock';
    case 'minecraft.java.geckolib5':
      return 'geckolib5';
    case 'ashfox.generic':
    case 'minecraft.java_block':
      return null;
  }
};

export const setProjectTargetCommand = defineCommand({
  name: 'project.target.set',
  label: 'Set export target',
  purpose: 'Select one canonical target preset.',
  inputSchema,
  apply: (document, payload) => {
    const { namespace, modelPath } = targetInput(
      document,
      payload.target
    );
    return configureProjectTarget(
      document,
      payload.target,
      namespace,
      modelPath
    );
  }
});
