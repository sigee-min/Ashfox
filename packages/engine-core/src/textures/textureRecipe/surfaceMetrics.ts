import type {
  CubeFaceDirection,
  CubeNode,
  ProjectDocument,
  TextureAsset
} from '../../model';
import {
  buildCompiledSurfaceAuthority,
  type CompiledSurfaceAuthority
} from '../generatedSurfaceAuthority';
import { cubeFaceDimensions } from '../uvAtlas';

const BASE_PIXELS_PER_BLOCK = 16;
export const GENERATED_ATLAS_MIN_RESOLUTION = 16;
export const GENERATED_ATLAS_MAX_RESOLUTION = 4096;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const EPSILON = 1e-9;

const previewColor = (texture: TextureAsset): string => {
  const value = texture.metadata?.previewColor;
  return typeof value === 'string' && COLOR_PATTERN.test(value)
    ? value
    : '#8e98a3';
};

export const generatedTextureBaseColor = (
  texture: TextureAsset
): string => texture.raster?.background ?? previewColor(texture);

const modelUnitsPerBlock = (document: ProjectDocument): number =>
  document.settings.coordinateSystem.unit === 'pixel' ? 16 : 1;

export const generatedPixelsPerBlock = (
  document: ProjectDocument
): number =>
  BASE_PIXELS_PER_BLOCK * document.settings.surfacePixelDensity;

export const generatedTexelsPerModelUnit = (
  document: ProjectDocument
): number =>
  generatedPixelsPerBlock(document) / modelUnitsPerBlock(document);

export const generatedTextureGutter = (
  document: ProjectDocument
): number => document.settings.surfacePixelDensity;

const effectiveFaceDimensions = (
  node: CubeNode,
  direction: CubeFaceDirection
): { width: number; height: number } => {
  const inflate = node.inflate * 2;
  const scale = node.transform.scale.map((value) => Math.abs(value));
  const size = [
    Math.max(
      0,
      Math.abs(node.bounds.to[0] - node.bounds.from[0]) + inflate
    ) * scale[0],
    Math.max(
      0,
      Math.abs(node.bounds.to[1] - node.bounds.from[1]) + inflate
    ) * scale[1],
    Math.max(
      0,
      Math.abs(node.bounds.to[2] - node.bounds.from[2]) + inflate
    ) * scale[2]
  ] as const;
  return cubeFaceDimensions([0, 0, 0], size, direction);
};

export const hasTextureSurfaceArea = (
  node: CubeNode,
  direction: CubeFaceDirection
): boolean => {
  const dimensions = effectiveFaceDimensions(node, direction);
  return dimensions.width > 0 && dimensions.height > 0;
};

export const exactGeneratedTexelSize = (
  document: ProjectDocument,
  node: CubeNode,
  direction: CubeFaceDirection
): { width: number; height: number } | null => {
  const dimensions = effectiveFaceDimensions(node, direction);
  const scale = generatedTexelsPerModelUnit(document);
  const width = dimensions.width * scale;
  const height = dimensions.height * scale;
  const roundedWidth = Math.round(width);
  const roundedHeight = Math.round(height);
  return (
    roundedWidth > 0 &&
    roundedHeight > 0 &&
    Math.abs(width - roundedWidth) <= EPSILON &&
    Math.abs(height - roundedHeight) <= EPSILON
  )
    ? { width: roundedWidth, height: roundedHeight }
    : null;
};

export const compileTextureSurfaceAuthority = (
  document: ProjectDocument
): CompiledSurfaceAuthority =>
  buildCompiledSurfaceAuthority(document, {
    texelsPerModelUnit: generatedTexelsPerModelUnit(document),
    faceSize: (cube, direction) =>
      exactGeneratedTexelSize(document, cube, direction)
  });
