import type {
  AssetId,
  ProjectDocument,
  TextureAsset
} from '../../../model';
import {
  validateProjectDocument,
  type InvariantFinding
} from '../../../validation';
import { createJsonExportFile } from '../../json';
import {
  BlobResolutionError,
  ExportMaterializationRequiredError,
  ProjectExportError,
  type BinaryExportFile,
  type BlobResolver,
  type BlobCopyExportFile,
  type ExportBundle,
  type ResolvedBlob
} from '../../types';
import { compileGltfAnimations } from './animationCompiler';
import { GltfBinaryWriter } from './binaryWriter';
import { buildGlb } from './glb';
import { compileGltfScene } from './sceneCompiler';
import type {
  GltfDocument,
  GltfImage,
  GltfMaterial,
  GltfSampler
} from './types';

export interface GltfBuildOptions {
  resolvedTextures?: ReadonlyMap<AssetId, ResolvedBlob>;
}

export interface GltfResolvedExportOptions {
  resolveBlob: BlobResolver;
}

export interface CompiledGltf {
  document: GltfDocument;
  binary: Uint8Array;
  textureFiles: BlobCopyExportFile[];
}

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

const unitScaleFor = (document: ProjectDocument): number => {
  switch (document.settings.coordinateSystem.unit) {
    case 'pixel':
      return 1 / 16;
    case 'block':
    case 'meter':
      return 1;
  }
};

const validateResolvedTexture = (
  texture: TextureAsset,
  resolved: ResolvedBlob
): ResolvedBlob => {
  if (!(resolved.bytes instanceof Uint8Array)) {
    throw new BlobResolutionError(
      'blob.invalid_bytes',
      texture.id,
      texture.source,
      `Resolved texture "${texture.id}" did not provide Uint8Array bytes.`
    );
  }
  if (resolved.contentType !== texture.source.contentType) {
    throw new BlobResolutionError(
      'blob.content_type_mismatch',
      texture.id,
      texture.source,
      `Resolved texture "${texture.id}" has content type "${resolved.contentType}", expected "${texture.source.contentType}".`
    );
  }
  if (
    texture.source.byteLength !== undefined &&
    resolved.bytes.byteLength !== texture.source.byteLength
  ) {
    throw new BlobResolutionError(
      'blob.byte_length_mismatch',
      texture.id,
      texture.source,
      `Resolved texture "${texture.id}" has ${resolved.bytes.byteLength} bytes, expected ${texture.source.byteLength}.`
    );
  }
  return resolved;
};

const requireResolvedTexture = (
  texture: TextureAsset,
  resolvedTextures: ReadonlyMap<AssetId, ResolvedBlob> | undefined
): ResolvedBlob => {
  const resolved = resolvedTextures?.get(texture.id);
  if (!resolved) {
    throw new ExportMaterializationRequiredError(
      `Embedded GLB export requires resolved bytes for texture "${texture.id}".`
    );
  }
  return validateResolvedTexture(texture, resolved);
};

const sortedTextures = (document: ProjectDocument): TextureAsset[] =>
  Object.values(document.textures).sort((left, right) =>
    left.id.localeCompare(right.id)
  );

export const buildGltf = (
  document: ProjectDocument,
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
  const textures = sortedTextures(document);
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
      generator: 'Ashfox Engine Core',
      ...(profile.copyright ? { copyright: profile.copyright } : {})
    },
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

const createGltfBundle = (
  document: ProjectDocument,
  compiled: CompiledGltf,
  findings: readonly InvariantFinding[]
): ExportBundle => {
  const profile = document.formatProfile;
  if (profile.id !== 'gltf.2') {
    throw new Error('Project does not use the gltf.2 profile.');
  }
  const modelPath = `${profile.modelPath}.${profile.container}`;
  const binaryPath = `${profile.modelPath}.bin`;
  const modelFile =
    profile.container === 'gltf'
      ? createJsonExportFile(
          'model',
          modelPath,
          compiled.document,
          'model/gltf+json'
        )
      : ({
          kind: 'binary',
          role: 'model',
          path: modelPath,
          contentType: 'model/gltf-binary',
          data: buildGlb(compiled.document, compiled.binary)
        } satisfies BinaryExportFile);
  const binaryFiles: BinaryExportFile[] =
    profile.container === 'gltf' && compiled.binary.byteLength > 0
      ? [
          {
            kind: 'binary',
            role: 'buffer',
            path: binaryPath,
            contentType: 'application/octet-stream',
            data: compiled.binary
          }
        ]
      : [];

  return {
    schemaVersion: 1,
    projectId: document.id,
    revision: document.revision,
    target: {
      id: 'gltf.2',
      version: profile.version
    },
    rootPath: 'gltf',
    entrypoints: [modelPath],
    files: [modelFile, ...binaryFiles, ...compiled.textureFiles],
    findings
  };
};

const validateGltfExport = (
  document: ProjectDocument
): readonly InvariantFinding[] => {
  const report = validateProjectDocument(document);
  if (!report.valid || document.formatProfile.id !== 'gltf.2') {
    throw new ProjectExportError(
      'glTF 2.0 export validation failed.',
      report.findings
    );
  }
  return report.findings;
};

const resolveTexture = async (
  texture: TextureAsset,
  resolveBlob: BlobResolver
): Promise<readonly [AssetId, ResolvedBlob]> => {
  let resolved: ResolvedBlob | null;
  try {
    resolved = await resolveBlob(texture.source);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new BlobResolutionError(
      'blob.read_failed',
      texture.id,
      texture.source,
      `Failed to resolve texture "${texture.id}": ${reason}`
    );
  }
  if (!resolved) {
    throw new BlobResolutionError(
      'blob.not_found',
      texture.id,
      texture.source,
      `Texture blob "${texture.source.bucket}/${texture.source.key}" was not found.`
    );
  }
  validateResolvedTexture(texture, resolved);
  return [texture.id, resolved];
};

export const exportGltf = (document: ProjectDocument): ExportBundle => {
  const findings = validateGltfExport(document);
  const profile = document.formatProfile;
  if (profile.id !== 'gltf.2') {
    throw new Error('Project does not use the gltf.2 profile.');
  }
  if (
    profile.imageStorage === 'embedded' &&
    Object.keys(document.textures).length > 0
  ) {
    throw new ExportMaterializationRequiredError(
      'Embedded GLB export requires exportGltfResolved() and a BlobResolver.'
    );
  }
  const compiled = buildGltf(document);
  return createGltfBundle(document, compiled, findings);
};

export const exportGltfResolved = async (
  document: ProjectDocument,
  options: GltfResolvedExportOptions
): Promise<ExportBundle> => {
  const findings = validateGltfExport(document);
  const profile = document.formatProfile;
  if (profile.id !== 'gltf.2') {
    throw new Error('Project does not use the gltf.2 profile.');
  }
  if (profile.imageStorage === 'external') {
    const compiled = buildGltf(document);
    return createGltfBundle(document, compiled, findings);
  }
  const entries = await Promise.all(
    sortedTextures(document).map((texture) =>
      resolveTexture(texture, options.resolveBlob)
    )
  );
  const compiled = buildGltf(document, {
    resolvedTextures: new Map(entries)
  });
  return createGltfBundle(document, compiled, findings);
};
