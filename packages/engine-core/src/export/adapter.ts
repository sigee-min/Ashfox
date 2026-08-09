import type {
  AssetId,
  ProjectDocument,
  TextureAsset
} from '../model';
import { resourceToken } from '../resourceToken';
import type {
  ExportFormatProfile,
  MinecraftTextureBinding
} from './adapterTypes';
import {
  isExportModelPathValid,
  isExportNamespaceValid,
  type ExportPreset,
  type MinecraftGameVersion
} from './compatibility';
import { exportProfileForAdapter } from './compatibility/profiles';

/**
 * Ephemeral delivery configuration.  It is deliberately not part of the
 * persisted project: changing a delivery target cannot alter compiler-owned
 * geometry, texture layout, authoring evidence, or animation state.
 */
export interface ExportAdapterInput {
  target: ExportPreset;
  gameVersion?: MinecraftGameVersion;
  namespace?: string;
  modelPath?: string;
}

export interface ResolvedExportAdapter {
  target: ExportPreset;
  profile: ExportFormatProfile;
}

export interface ExportTextureAsset extends TextureAsset {
  minecraft?: MinecraftTextureBinding;
}

/** Target-shaped transient view consumed only by delivery adapters. */
export interface ExportAdaptedDocument extends Omit<
  ProjectDocument,
  'textures'
> {
  formatProfile: ExportFormatProfile;
  textures: Readonly<Record<AssetId, ExportTextureAsset>>;
}

type DeliveryShapedProject = ProjectDocument & {
  formatProfile?: unknown;
  textures: Readonly<Record<AssetId, ExportTextureAsset>>;
};

const canonicalTextureAssets = (
  textures: Readonly<Record<AssetId, ExportTextureAsset>>
): Record<AssetId, TextureAsset> =>
  Object.fromEntries(
    Object.entries(textures).map(([id, texture]) => {
      const { minecraft: _minecraft, ...canonicalTexture } = texture;
      return [id, canonicalTexture];
    })
  );

/**
 * Strips delivery-only fields even if a caller accidentally supplies a prior
 * adapter view. This makes each target selection a fresh projection from
 * canonical project authority, never a conversion from another target.
 */
const canonicalProjectFromDeliveryShape = (
  document: DeliveryShapedProject
): ProjectDocument => {
  const {
    formatProfile: _formatProfile,
    textures,
    ...canonicalFields
  } = document;
  return {
    ...canonicalFields,
    textures: canonicalTextureAssets(textures)
  } as ProjectDocument;
};

/** Removes ephemeral delivery data before canonical validation or persistence. */
export const canonicalProjectFromExportAdapter = (
  document: ExportAdaptedDocument
): ProjectDocument => canonicalProjectFromDeliveryShape(document);

const isMinecraftProfile = (
  profile: ExportFormatProfile
): profile is Extract<ExportFormatProfile, {
  id:
    | 'minecraft.java_block'
    | 'minecraft.bedrock'
    | 'minecraft.java.geckolib5';
}> =>
  profile.id === 'minecraft.java_block' ||
  profile.id === 'minecraft.bedrock' ||
  profile.id === 'minecraft.java.geckolib5';

const profileKind = (
  profile: Extract<ExportFormatProfile, {
    id:
      | 'minecraft.java_block'
      | 'minecraft.bedrock'
      | 'minecraft.java.geckolib5';
  }>
): 'block' | 'item' | 'entity' =>
  profile.id === 'minecraft.java_block'
    ? profile.modelKind
    : profile.id === 'minecraft.bedrock'
      ? profile.geometryKind
      : profile.assetKind;

const normalizedModelPath = (
  document: ProjectDocument,
  target: ExportPreset,
  value: string | undefined
): string => {
  const result = value?.trim() ?? resourceToken(document.name, 'asset');
  if (!result || !isExportModelPathValid(target, result)) {
    throw new Error(
      'Export model path must be a safe extensionless relative path.'
    );
  }
  return result;
};

const normalizedNamespace = (
  target: ExportPreset,
  value: string | undefined
): string => {
  const result = value?.trim() ?? 'ashfox';
  if (!isExportNamespaceValid(target, result)) {
    throw new Error(
      'Export namespace must use lowercase letters, digits, dots, underscores, or hyphens.'
    );
  }
  return result;
};

export const resolveExportAdapter = (
  document: ProjectDocument,
  input: ExportAdapterInput
): ResolvedExportAdapter => {
  const modelPath = normalizedModelPath(
    document,
    input.target,
    input.modelPath
  );
  const namespace = normalizedNamespace(input.target, input.namespace);
  const profile = exportProfileForAdapter(
    input.target,
    input.gameVersion,
    namespace,
    modelPath
  );
  if (!profile) {
    throw new Error(
      'The requested target and game version are not a supported export adapter.'
    );
  }
  return { target: input.target, profile };
};

const adapterTextures = (
  document: ProjectDocument,
  profile: ExportFormatProfile
): ExportAdaptedDocument['textures'] => {
  if (!isMinecraftProfile(profile)) return document.textures;
  return Object.fromEntries(
    Object.entries(document.textures)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, texture], index) => [
        id,
        {
          ...texture,
          minecraft: createMinecraftTextureBinding(
            {
              namespace: profile.namespace,
              kind: profileKind(profile),
              modelPath: profile.modelPath
            },
            id,
            index
          )
        }
      ])
  );
};

const createMinecraftTextureBinding = (
  location: {
    namespace: string;
    kind: 'block' | 'item' | 'entity';
    modelPath: string;
  },
  id: string,
  ordinal: number
): MinecraftTextureBinding => {
  const token = resourceToken(id, 'texture');
  const suffix = ordinal === 0 ? '' : `_${token}`;
  return {
    key: ordinal === 0 ? 'base' : `${token}_${ordinal}`,
    resource: {
      namespace: location.namespace,
      path: `${location.kind}/${location.modelPath}${suffix}`
    },
    extension: 'png',
    particle: ordinal === 0
  };
};

/** Builds a non-persisted target view immediately before export. */
export const adaptProjectForExport = (
  document: ProjectDocument,
  input: ExportAdapterInput
): ExportAdaptedDocument => {
  const canonical = canonicalProjectFromDeliveryShape(
    document as DeliveryShapedProject
  );
  const adapter = resolveExportAdapter(canonical, input);
  return {
    ...canonical,
    formatProfile: adapter.profile,
    textures: adapterTextures(canonical, adapter.profile)
  };
};
