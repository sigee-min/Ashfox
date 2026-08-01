import type { BoneCreateInput, Vec3 } from '@ashfox/engine-core';

import {
  demoBone,
  demoCube,
  type DemoCubeSpec
} from './demoFactory';

interface PartOptions {
  name?: string;
  rotation?: Vec3;
  inflate?: number;
}

export interface ShowcaseDemoBuilder {
  bones: BoneCreateInput[];
  cubes: DemoCubeSpec[];
  bone: (
    id: string,
    parentId: string | null,
    pivot: Vec3,
    name?: string
  ) => string;
  cube: (
    id: string,
    parentId: string,
    pivot: Vec3,
    center: Vec3,
    size: Vec3,
    textureId: string,
    options?: PartOptions
  ) => void;
  part: (
    id: string,
    parentId: string,
    pivot: Vec3,
    center: Vec3,
    size: Vec3,
    textureId: string,
    options?: PartOptions
  ) => string;
}

const readableName = (id: string): string =>
  id.replace(/^bone-/, '').replaceAll('-', '_');

export const createShowcaseDemoBuilder = (): ShowcaseDemoBuilder => {
  const bones: BoneCreateInput[] = [];
  const cubes: DemoCubeSpec[] = [];
  const boneIds = new Set<string>();
  const cubeIds = new Set<string>();

  const bone = (
    id: string,
    parentId: string | null,
    pivot: Vec3,
    name = readableName(id)
  ): string => {
    if (boneIds.has(id)) throw new Error(`Duplicate showcase bone: ${id}`);
    boneIds.add(id);
    bones.push(demoBone(id, parentId, pivot, name));
    return id;
  };

  const cube = (
    id: string,
    parentId: string,
    pivot: Vec3,
    center: Vec3,
    size: Vec3,
    textureId: string,
    options: PartOptions = {}
  ): void => {
    if (cubeIds.has(id)) throw new Error(`Duplicate showcase cube: ${id}`);
    cubeIds.add(id);
    cubes.push(
      demoCube(id, parentId, pivot, center, size, textureId, options)
    );
  };

  const part = (
    id: string,
    parentId: string,
    pivot: Vec3,
    center: Vec3,
    size: Vec3,
    textureId: string,
    options: PartOptions = {}
  ): string => {
    const boneId = bone(`bone-${id}`, parentId, pivot, options.name);
    cube(
      `cube-${id}`,
      boneId,
      pivot,
      center,
      size,
      textureId,
      options
    );
    return boneId;
  };

  return { bones, cubes, bone, cube, part };
};

export const pointOnCircle = (
  center: Vec3,
  radius: number,
  angleDegrees: number,
  yOffset = 0
): Vec3 => {
  const radians = angleDegrees * Math.PI / 180;
  return [
    center[0] + Math.sin(radians) * radius,
    center[1] + yOffset,
    center[2] - Math.cos(radians) * radius
  ];
};
