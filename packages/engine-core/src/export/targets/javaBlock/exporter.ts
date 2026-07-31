import {
  CUBE_FACE_DIRECTIONS,
  type BlobRef,
  type CubeFaceDirection,
  type CubeNode,
  type MinecraftJavaBlockFormatProfile,
  type ProjectDocument,
  type TextureAsset,
  type Vec3
} from '../../../model';
import {
  effectivelyVisibleSceneNodeIds
} from '../../../sceneVisibility';
import { validateProjectDocument } from '../../../validation';
import { createExportAdaptationReceipt } from '../../adaptations';
import {
  supportsJavaBlockMultiAxisRotation
} from '../../compatibility';
import { createJsonExportFile } from '../../json';
import {
  ProjectExportError,
  type BlobCopyExportFile,
  type ExportBundle
} from '../../types';
import {
  buildMinecraftJavaBlockState,
  buildMinecraftJavaPackMetadata
} from './resourcePack';

export interface MinecraftJavaFace {
  uv: [number, number, number, number];
  texture: string;
  rotation?: 90 | 180 | 270;
  cullface?: CubeFaceDirection;
  tintindex?: number;
}

export interface MinecraftJavaAxisRotation {
  origin: [number, number, number];
  axis: 'x' | 'y' | 'z';
  angle: number;
  rescale?: boolean;
}

export interface MinecraftJavaEulerRotation {
  origin: [number, number, number];
  x?: number;
  y?: number;
  z?: number;
  rescale?: boolean;
}

export interface MinecraftJavaElement {
  name?: string;
  from: [number, number, number];
  to: [number, number, number];
  rotation?: MinecraftJavaAxisRotation | MinecraftJavaEulerRotation;
  shade?: boolean;
  light_emission?: number;
  faces: Partial<Record<CubeFaceDirection, MinecraftJavaFace>>;
}

export interface MinecraftJavaModel {
  parent?: string;
  ambientocclusion?: boolean;
  gui_light?: 'front';
  texture_size?: [number, number];
  textures: Record<string, string>;
  elements: MinecraftJavaElement[];
}

const addPosition = (value: Vec3, position: Vec3): [number, number, number] => [
  value[0] + position[0],
  value[1] + position[1],
  value[2] + position[2]
];

const compileJavaRotation = (
  cube: CubeNode,
  profile: MinecraftJavaBlockFormatProfile
): MinecraftJavaAxisRotation | MinecraftJavaEulerRotation | undefined => {
  const rotation = cube.transform.rotation;
  const activeAxes = rotation
    .map((angle, index) => ({ angle, index }))
    .filter(({ angle }) => Math.abs(angle) > 0.000001);

  if (activeAxes.length === 0 && !cube.rescale) return undefined;

  const origin = addPosition(cube.transform.pivot, cube.transform.position);
  const primary = activeAxes[0] ?? { angle: 0, index: 1 };
  const canUseAxisRotation =
    activeAxes.length <= 1 && Math.abs(primary.angle) <= 45;

  if (
    canUseAxisRotation ||
    !supportsJavaBlockMultiAxisRotation(profile.minecraftVersion)
  ) {
    const axes = ['x', 'y', 'z'] as const;
    return {
      origin,
      axis: axes[primary.index],
      angle: primary.angle,
      ...(cube.rescale ? { rescale: true } : {})
    };
  }

  return {
    origin,
    ...(Math.abs(rotation[0]) > 0.000001 ? { x: rotation[0] } : {}),
    ...(Math.abs(rotation[1]) > 0.000001 ? { y: rotation[1] } : {}),
    ...(Math.abs(rotation[2]) > 0.000001 ? { z: rotation[2] } : {}),
    ...(cube.rescale ? { rescale: true } : {})
  };
};

const textureBindingFor = (texture: TextureAsset): NonNullable<TextureAsset['minecraft']> => {
  if (!texture.minecraft) {
    throw new Error(`Texture "${texture.id}" has no Minecraft binding.`);
  }
  return texture.minecraft;
};

const compileJavaElement = (
  document: ProjectDocument,
  profile: MinecraftJavaBlockFormatProfile,
  cube: CubeNode
): MinecraftJavaElement => {
  const from = addPosition(cube.bounds.from, cube.transform.position);
  const to = addPosition(cube.bounds.to, cube.transform.position);
  for (let axis = 0; axis < 3; axis += 1) {
    from[axis] -= cube.inflate;
    to[axis] += cube.inflate;
  }

  const faces: Partial<Record<CubeFaceDirection, MinecraftJavaFace>> = {};
  const resolution = document.settings.textureResolution;
  for (const direction of CUBE_FACE_DIRECTIONS) {
    const face = cube.faces[direction];
    if (!face.enabled || face.textureId === null || !face.uv) continue;
    const texture = document.textures[face.textureId];
    const binding = textureBindingFor(texture);
    const uv: [number, number, number, number] = [
      (face.uv[0] * 16) / resolution.width,
      (face.uv[1] * 16) / resolution.height,
      (face.uv[2] * 16) / resolution.width,
      (face.uv[3] * 16) / resolution.height
    ];
    faces[direction] = {
      uv,
      texture: `#${binding.key}`,
      ...(face.rotation ? { rotation: face.rotation } : {}),
      ...(face.cullFace ? { cullface: face.cullFace } : {}),
      ...(face.tintIndex !== undefined ? { tintindex: face.tintIndex } : {})
    };
  }
  const rotation = compileJavaRotation(cube, profile);

  return {
    ...(cube.name !== 'cube' ? { name: cube.name } : {}),
    from,
    to,
    ...(rotation ? { rotation } : {}),
    ...(cube.shade === false ? { shade: false } : {}),
    ...(cube.lightEmission ? { light_emission: cube.lightEmission } : {}),
    faces
  };
};

const compileTextureMap = (document: ProjectDocument): Record<string, string> => {
  const textures: Record<string, string> = {};
  const orderedTextures = Object.values(document.textures).sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  for (const texture of orderedTextures) {
    const binding = textureBindingFor(texture);
    textures[binding.key] = `${binding.resource.namespace}:${binding.resource.path}`;
    if (binding.particle) {
      textures.particle = `#${binding.key}`;
    }
  }
  return textures;
};

const createTextureCopy = (texture: TextureAsset): BlobCopyExportFile => {
  const binding = textureBindingFor(texture);
  return {
    kind: 'blob-copy',
    role: 'texture',
    path: `assets/${binding.resource.namespace}/textures/${binding.resource.path}.${binding.extension}`,
    contentType: texture.source.contentType,
    source: texture.source as BlobRef
  };
};

export const buildMinecraftJavaModel = (document: ProjectDocument): MinecraftJavaModel => {
  const profile = document.formatProfile;
  if (profile.id !== 'minecraft.java_block') {
    throw new Error('Project does not use the minecraft.java_block profile.');
  }

  const visibleNodeIds =
    effectivelyVisibleSceneNodeIds(document);
  const cubes = Object.values(document.scene.nodes)
    .filter(
      (node): node is CubeNode =>
        node.kind === 'cube' && visibleNodeIds.has(node.id)
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const model: MinecraftJavaModel = {
    ...(profile.parent ? { parent: profile.parent } : {}),
    ...(profile.ambientOcclusion === false ? { ambientocclusion: false } : {}),
    ...(profile.guiLight === 'front' ? { gui_light: 'front' as const } : {}),
    ...(document.settings.textureResolution.width !== 16 ||
    document.settings.textureResolution.height !== 16
      ? {
          texture_size: [
            document.settings.textureResolution.width,
            document.settings.textureResolution.height
          ] as [number, number]
        }
      : {}),
    textures: compileTextureMap(document),
    elements: cubes.map((cube) => compileJavaElement(document, profile, cube))
  };
  return model;
};

export const exportMinecraftJavaBlock = (document: ProjectDocument): ExportBundle => {
  const report = validateProjectDocument(document);
  if (!report.valid || document.formatProfile.id !== 'minecraft.java_block') {
    throw new ProjectExportError('Minecraft Java export validation failed.', report.findings);
  }
  const profile = document.formatProfile;
  const packMetadataPath = 'pack.mcmeta';
  const modelPath =
    `assets/${profile.namespace}/models/block/${profile.modelPath}.json`;
  const blockstatePath =
    `assets/${profile.namespace}/blockstates/${profile.modelPath}.json`;
  const model = buildMinecraftJavaModel(document);
  const textureFiles = Object.values(document.textures)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(createTextureCopy);

  return {
    schemaVersion: 1,
    projectId: document.id,
    revision: document.revision,
    target: {
      id: 'minecraft.java_block',
      version: profile.minecraftVersion
    },
    rootPath: 'resource-pack',
    entrypoints: [
      packMetadataPath,
      blockstatePath,
      modelPath
    ],
    files: [
      createJsonExportFile(
        'manifest',
        packMetadataPath,
        buildMinecraftJavaPackMetadata(document)
      ),
      createJsonExportFile(
        'blockstate',
        blockstatePath,
        buildMinecraftJavaBlockState(document)
      ),
      createJsonExportFile('model', modelPath, model),
      ...textureFiles
    ],
    findings: report.findings,
    adaptations: createExportAdaptationReceipt(document)
  };
};
