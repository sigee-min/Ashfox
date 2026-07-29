import * as THREE from 'three';

import type {
  ProjectDocument,
  TextureAsset
} from '@ashfox/engine-core';

import { renderTextureRaster } from '../../textures/renderTextureRaster';
import type {
  ProjectAsset,
  ProjectAssets
} from '../../files/projectAssets';

const previewColor = (texture: TextureAsset): string => {
  const value = texture.metadata?.previewColor;
  return typeof value === 'string' ? value : '#8e98a3';
};

const configureTextureMap = (
  map: THREE.Texture,
  texture: TextureAsset
): THREE.Texture => {
  const filter =
    texture.sampling === 'nearest'
      ? THREE.NearestFilter
      : THREE.LinearFilter;
  map.magFilter = filter;
  map.minFilter = filter;
  map.generateMipmaps = false;
  map.colorSpace =
    texture.colorSpace === 'srgb'
      ? THREE.SRGBColorSpace
      : THREE.NoColorSpace;
  map.needsUpdate = true;
  return map;
};

const createRasterTextureMap = (
  texture: TextureAsset
): THREE.Texture =>
  configureTextureMap(
    new THREE.CanvasTexture(renderTextureRaster(texture)),
    texture
  );

const createStoredTextureMap = (
  texture: TextureAsset,
  asset: ProjectAsset
): THREE.Texture => {
  const copy = new Uint8Array(asset.bytes);
  const url = URL.createObjectURL(
    new Blob([copy.buffer], { type: asset.contentType })
  );
  let map: THREE.Texture;
  const releaseUrl = (): void => {
    URL.revokeObjectURL(url);
    delete map.userData.ashfoxObjectUrl;
  };
  map = new THREE.TextureLoader().load(
    url,
    releaseUrl,
    undefined,
    releaseUrl
  );
  map.userData.ashfoxObjectUrl = url;
  return configureTextureMap(map, texture);
};

export const createProjectMaterials = (
  document: ProjectDocument,
  assets: ProjectAssets
): Map<string, THREE.MeshStandardMaterial> => {
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  for (const texture of Object.values(document.textures)) {
    const map = texture.raster
      ? createRasterTextureMap(texture)
      : assets[texture.id]
        ? createStoredTextureMap(texture, assets[texture.id])
        : null;
    materials.set(
      texture.id,
      new THREE.MeshStandardMaterial({
        color: map ? '#ffffff' : previewColor(texture),
        map,
        roughness: 0.84,
        metalness: 0.02,
        side:
          texture.renderSides === 'double'
            ? THREE.DoubleSide
            : THREE.FrontSide
      })
    );
  }
  return materials;
};

export const createFallbackMaterial =
  (): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({
      color: '#808892',
      roughness: 0.9
    });

export const disposeMaterial = (material: THREE.Material): void => {
  if ('map' in material) {
    const map = material.map as THREE.Texture | null;
    const url = map?.userData.ashfoxObjectUrl;
    if (typeof url === 'string') URL.revokeObjectURL(url);
    map?.dispose();
  }
  material.dispose();
};
