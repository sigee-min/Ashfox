import type {
  AnimationClip,
  ProjectDocument,
  ProjectFormatProfile
} from '../../model';
import { defineCommand } from '../definition';
import type { ExportPreset } from '../types';

const MINECRAFT_ANIMATION_NAME = /^animation\.[a-z0-9_.-]+$/;

const inputSchema = {
  type: 'object',
  properties: {
    target: {
      enum: ['gltf', 'glb', 'bedrock', 'geckolib5', 'java']
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
    case 'java':
      return {
        id: 'minecraft.java_block',
        version: '1.21.11',
        namespace,
        modelPath,
        modelKind: 'block'
      };
  }
};

const resourceToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '') || 'clip';

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
  const prefix = `animation.${resourceToken(modelPath.split('/').join('.'))}`;
  const preferred = `${prefix}.${resourceToken(clip.name)}`;
  return usedNames.has(preferred)
    ? `${preferred}.${resourceToken(clip.id)}`
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
  if (target !== 'bedrock' && target !== 'geckolib5') {
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
          key: resourceToken(id),
          resource: {
            namespace,
            path: index === 0
              ? `entity/${modelPath}`
              : `entity/${modelPath}_${resourceToken(texture.name)}`
          },
          extension: 'png' as const,
          particle: index === 0
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
  apply: (document, payload) => ({
    ok: true,
    value: {
      document: {
        ...document,
        formatProfile: profileFor(
          payload.target,
          payload.namespace,
          payload.modelPath
        ),
        animations: animationsFor(
          document,
          payload.target,
          payload.modelPath
        ),
        textures: texturesFor(
          document,
          payload.target,
          payload.namespace,
          payload.modelPath
        )
      },
      summary: `Set ${payload.target} export target`,
      effects: {
        createdEntityIds: [],
        changedEntityIds: [document.id],
        removedEntityIds: [],
        invalidated: ['validation', 'preview']
      }
    }
  })
});
