import type {
  ProjectDocument,
  ProjectFormatProfile
} from '../../model';
import { canonicalJsonString } from '../../canonicalJson';
import { resourceToken } from '../../resourceToken';
import {
  createMinecraftTextureBinding
} from '../../textures/createTextureAsset';
import {
  EXPORT_COMPATIBILITY_REGISTRY,
  exportPresetForFormatProfile,
  formatProfileForExport,
  gameVersionForFormatProfile,
  isExportModelPathValid,
  isExportNamespaceValid,
  normalizeExportModelPath,
  preserveFormatProfilePreferences,
  type MinecraftGameVersion
} from '../../export/compatibility';
import {
  defineCommand,
  type CommandApplicationResult
} from '../definition';
import type {
  CommandInputSchema
} from '../schema';
import type {
  ExportPreset
} from '../types';

const inputSchema: CommandInputSchema = {
  anyOf: EXPORT_COMPATIBILITY_REGISTRY.map((compatibility) => ({
    type: 'object' as const,
    properties: {
      target: {
        enum: [compatibility.target]
      },
      ...(compatibility.gameVersion === null
        ? {}
        : {
            gameVersion: {
              enum: [compatibility.gameVersion]
            }
          })
    },
    required: ['target'],
    additionalProperties: false
  }))
};

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
  modelPath: normalizeExportModelPath(
    target,
    currentModelPath(document)
  )
});

const texturesFor = (
  document: ProjectDocument,
  profile: ProjectFormatProfile
): ProjectDocument['textures'] => {
  if (
    profile.id !== 'minecraft.java_block' &&
    profile.id !== 'minecraft.bedrock' &&
    profile.id !== 'minecraft.java.geckolib5'
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
              namespace: profile.namespace,
              kind:
                profile.id === 'minecraft.java_block'
                  ? profile.modelKind
                  : profile.id === 'minecraft.bedrock'
                    ? profile.geometryKind
                    : profile.assetKind,
              modelPath: profile.modelPath
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
  gameVersion?: MinecraftGameVersion,
  summary = `Set ${target} export target`
): CommandApplicationResult => {
  const invalidNamespace =
    !isExportNamespaceValid(target, namespace);
  if (
    invalidNamespace ||
    !isExportModelPathValid(target, modelPath)
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
    };
  }
  const derivedFormatProfile = formatProfileForExport(
    target,
    gameVersion,
    namespace,
    modelPath
  );
  if (!derivedFormatProfile) {
    return {
      ok: false,
      error: {
        code: 'invalid_payload',
        message:
          'The game version is not supported by the selected export target.',
        path: 'payload.gameVersion',
        expected: 'a target-compatible curated game version'
      }
    };
  }
  const formatProfile = preserveFormatProfilePreferences(
    document.formatProfile,
    derivedFormatProfile
  );
  const candidate: ProjectDocument = {
    ...document,
    formatProfile,
    textures: texturesFor(document, formatProfile)
  };
  const changed =
    canonicalJsonString(candidate) !==
    canonicalJsonString(document);
  return {
    ok: true,
    value: {
      document: changed ? candidate : document,
      summary,
      effects: {
        createdEntityIds: [],
        changedEntityIds: changed ? [document.id] : [],
        removedEntityIds: [],
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
): ExportPreset | null =>
  exportPresetForFormatProfile(document.formatProfile);

export const setProjectTargetCommand = defineCommand({
  name: 'project.target.set',
  label: 'Set export target',
  purpose:
    'Select one canonical target and compatible game version without changing authored scene or animation data.',
  inputSchema,
  apply: (document, payload) => {
    const { namespace, modelPath } = targetInput(
      document,
      payload.target
    );
    const currentTarget = exportPresetForDocument(document);
    const gameVersion =
      payload.gameVersion ??
      (
        currentTarget === payload.target
          ? gameVersionForFormatProfile(document.formatProfile) ?? undefined
          : undefined
      );
    return configureProjectTarget(
      document,
      payload.target,
      namespace,
      modelPath,
      gameVersion
    );
  }
});
