import type {
  TextureAsset
} from '../../../model';
import type { ExportAdaptedDocument } from '../../adapter';
import { validateExportTarget } from '../../pipeline/validateTarget';
import {
  ExportMaterializationRequiredError,
  type BlobCopyExportFile,
  type ExportBundle
} from '../../types';
import { compileGltfAnimations } from './animationCompiler';
import { GltfBinaryWriter } from './binaryWriter';
import type {
  CompiledGltf,
  GltfBuildOptions
} from './buildTypes';
import { createGltfBundle } from './bundle';
import { compressGltfWithMeshopt } from './meshoptCompression';
import {
  orderedTextures,
  requireResolvedTexture,
  resolveGltfTextures,
  type GltfResolvedExportOptions
} from './resolvedTextures';
import { compileGltfScene } from './sceneCompiler';
import type {
  GltfDocument,
  GltfImage,
  GltfMaterial,
  GltfSampler
} from './types';

export type {
  CompiledGltf,
  GltfBuildOptions
} from './buildTypes';
export type {
  GltfResolvedExportOptions
} from './resolvedTextures';

const textureExtension = (texture: TextureAsset): 'png' | 'jpg' =>
  texture.source.contentType === 'image/jpeg' ? 'jpg' : 'png';

const textureMimeType = (
  texture: TextureAsset
): 'image/png' | 'image/jpeg' => {
  if (
    texture.source.contentType !== 'image/png' &&
    texture.source.contentType !== 'image/jpeg'
  ) {
    throw new Error(
      `Texture "${texture.id}" is not a core glTF PNG or JPEG image.`
    );
  }
  return texture.source.contentType;
};

const unitScaleFor = (document: ExportAdaptedDocument): number => {
  switch (document.settings.coordinateSystem.unit) {
    case 'pixel':
      return 1 / 16;
    case 'block':
    case 'meter':
      return 1;
  }
};

export const buildGltf = (
  document: ExportAdaptedDocument,
  options: GltfBuildOptions = {}
): CompiledGltf => {
  const profile = document.formatProfile;
  if (profile.id !== 'gltf.2') {
    throw new Error('Project does not use the gltf.2 profile.');
  }

  const writer = new GltfBinaryWriter();
  const modelPathSegments = profile.modelPath.split('/');
  const modelFileName =
    modelPathSegments[modelPathSegments.length - 1];
  const modelDirectory = modelPathSegments.slice(0, -1).join('/');
  const textureDirectory =
    modelDirectory.length > 0
      ? `${modelDirectory}/textures`
      : 'textures';
  const textures = orderedTextures(document);
  const materialByTextureId = new Map<string, number>();
  const samplers: GltfSampler[] = [];
  const materials: GltfMaterial[] = [];
  const images: GltfImage[] = [];
  const textureFiles: BlobCopyExportFile[] = [];

  textures.forEach((texture, index) => {
    const mimeType = textureMimeType(texture);
    materialByTextureId.set(texture.id, index);
    samplers.push({
      magFilter: texture.sampling === 'nearest' ? 9728 : 9729,
      minFilter: texture.sampling === 'nearest' ? 9728 : 9729,
      wrapS: 10497,
      wrapT: 10497
    });
    materials.push({
      name: texture.name,
      pbrMetallicRoughness: {
        baseColorTexture: { index },
        metallicFactor: 0,
        roughnessFactor: 1
      },
      ...(texture.renderMode === 'emissive'
        ? {
            emissiveTexture: { index },
            emissiveFactor: [1, 1, 1] as [number, number, number]
          }
        : {}),
      ...(texture.renderMode === 'additive' || texture.renderMode === 'layered'
        ? { alphaMode: 'BLEND' as const }
        : {}),
      ...(texture.renderSides === 'double' ? { doubleSided: true } : {})
    });
    if (profile.imageStorage === 'embedded') {
      const resolved = requireResolvedTexture(
        texture,
        options.resolvedTextures
      );
      images.push({
        bufferView: writer.addBufferView(resolved.bytes),
        mimeType,
        name: texture.name
      });
    } else {
      images.push({
        uri: `textures/texture_${index}.${textureExtension(texture)}`,
        mimeType,
        name: texture.name
      });
      textureFiles.push({
        kind: 'blob-copy',
        role: 'texture',
        path: `${textureDirectory}/texture_${index}.${textureExtension(texture)}`,
        contentType: texture.source.contentType,
        source: texture.source
      });
    }
  });

  const unitScale = unitScaleFor(document);
  const scene = compileGltfScene(document, {
    writer,
    materialByTextureId,
    unitScale
  });
  const animations = compileGltfAnimations(document, {
    writer,
    nodeIndexById: scene.nodeIndexById,
    restTranslationById: scene.restTranslationById,
    restRotationById: scene.restRotationById,
    restScaleById: scene.restScaleById,
    unitScale
  });
  const binary = writer.toUint8Array();
  const documentData: GltfDocument = {
    asset: {
      version: '2.0',
      generator: 'ashfox engine core',
      ...(profile.copyright ? { copyright: profile.copyright } : {})
    },
    ...(writer.state.usesMeshQuantization
      ? {
          extensionsUsed: ['KHR_mesh_quantization' as const],
          extensionsRequired: ['KHR_mesh_quantization' as const]
        }
      : {}),
    scene: 0,
    scenes: [{ name: document.name, nodes: scene.rootNodeIndices }],
    nodes: scene.nodes,
    ...(binary.byteLength > 0
      ? {
          buffers: [
            {
              byteLength: binary.byteLength,
              ...(profile.container === 'gltf'
                ? { uri: `${modelFileName}.bin` }
                : {})
            }
          ],
          bufferViews: writer.state.bufferViews,
          accessors: writer.state.accessors
        }
      : {}),
    ...(scene.meshes.length > 0 ? { meshes: scene.meshes } : {}),
    ...(scene.skins.length > 0 ? { skins: scene.skins } : {}),
    ...(textures.length > 0
      ? {
          images,
          samplers,
          textures: textures.map((texture, index) => ({
            sampler: index,
            source: index,
            name: texture.name
          })),
          materials
        }
      : {}),
    ...(animations.length > 0 ? { animations } : {})
  };

  return {
    document: documentData,
    binary,
    textureFiles
  };
};

export const exportGltf = (document: ExportAdaptedDocument): ExportBundle => {
  const validation = validateExportTarget(document, {
    profileId: 'gltf.2',
    errorMessage: 'glTF 2.0 export validation failed.'
  });
  const profile = validation.profile;
  if (
    profile.imageStorage === 'embedded' &&
    Object.keys(document.textures).length > 0
  ) {
    throw new ExportMaterializationRequiredError(
      'Embedded GLB export requires exportGltfResolved() and a BlobResolver.'
    );
  }
  const compiled = buildGltf(document);
  return createGltfBundle(document, compiled, validation.findings);
};

export const exportGltfResolved = async (
  document: ExportAdaptedDocument,
  options: GltfResolvedExportOptions
): Promise<ExportBundle> => {
  const validation = validateExportTarget(document, {
    profileId: 'gltf.2',
    errorMessage: 'glTF 2.0 export validation failed.'
  });
  const profile = validation.profile;
  if (profile.imageStorage === 'external') {
    const compiled = await compressGltfWithMeshopt(buildGltf(document));
    return createGltfBundle(document, compiled, validation.findings);
  }
  const resolvedTextures = await resolveGltfTextures(
    document,
    options.resolveBlob
  );
  const compiled = await compressGltfWithMeshopt(
    buildGltf(document, { resolvedTextures })
  );
  return createGltfBundle(document, compiled, validation.findings);
};
