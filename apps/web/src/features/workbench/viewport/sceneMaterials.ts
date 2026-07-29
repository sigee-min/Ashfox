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

export interface ProjectMaterialLibrary {
  resolve(
    textureId: string | null,
    lightEmission?: number
  ): THREE.MeshStandardMaterial;
  dispose(): void;
}

export const materialEmissionIntensity = (
  renderMode: TextureAsset['renderMode'],
  lightEmission = 0
): number =>
  Math.max(
    renderMode === 'emissive' || renderMode === 'additive'
      ? 1.15
      : 0,
    Math.min(15, Math.max(0, lightEmission)) / 6
  );

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
  assets: ProjectAssets,
  untexturedColor = '#808892'
): ProjectMaterialLibrary => {
  const resources = new Map<
    string,
    { texture: TextureAsset; map: THREE.Texture | null }
  >();
  for (const texture of Object.values(document.textures)) {
    const map = texture.raster
      ? createRasterTextureMap(texture)
      : assets[texture.id]
        ? createStoredTextureMap(texture, assets[texture.id])
        : null;
    resources.set(texture.id, { texture, map });
  }
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const fallback = new THREE.MeshStandardMaterial({
    color: untexturedColor,
    roughness: 0.9
  });

  const resolve = (
    textureId: string | null,
    lightEmission = 0
  ): THREE.MeshStandardMaterial => {
    if (textureId === null) return fallback;
    const resource = resources.get(textureId);
    if (!resource) return fallback;
    const emission = materialEmissionIntensity(
      resource.texture.renderMode,
      lightEmission
    );
    const key = `${textureId}:${emission}`;
    const cached = materials.get(key);
    if (cached) return cached;
    const additive = resource.texture.renderMode === 'additive';
    const material = new THREE.MeshStandardMaterial({
      color: resource.map ? '#ffffff' : previewColor(resource.texture),
      map: resource.map,
      roughness: 0.84,
      metalness: 0.02,
      emissive:
        emission > 0
          ? resource.map
            ? '#ffffff'
            : previewColor(resource.texture)
          : '#000000',
      emissiveMap: emission > 0 ? resource.map : null,
      emissiveIntensity: emission,
      transparent: additive,
      blending: additive
        ? THREE.AdditiveBlending
        : THREE.NormalBlending,
      depthWrite: !additive,
      side:
        resource.texture.renderSides === 'double'
          ? THREE.DoubleSide
          : THREE.FrontSide
    });
    materials.set(key, material);
    return material;
  };

  return {
    resolve,
    dispose: () => {
      for (const material of materials.values()) material.dispose();
      fallback.dispose();
      for (const { map } of resources.values()) {
        if (!map) continue;
        const url = map.userData.ashfoxObjectUrl;
        if (typeof url === 'string') URL.revokeObjectURL(url);
        map.dispose();
      }
    }
  };
};

export const disposeMaterial = (material: THREE.Material): void => {
  if ('map' in material) {
    const map = material.map as THREE.Texture | null;
    const url = map?.userData.ashfoxObjectUrl;
    if (typeof url === 'string') URL.revokeObjectURL(url);
    map?.dispose();
  }
  material.dispose();
};
