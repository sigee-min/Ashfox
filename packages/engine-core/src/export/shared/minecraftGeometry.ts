import {
  CUBE_FACE_DIRECTIONS,
  type BoneNode,
  type CubeFaceDirection,
  type CubeNode,
  type LocatorNode,
  type ProjectDocument,
  type Vec3
} from '../../model';
import {
  effectivelyVisibleSceneNodeIds
} from '../../sceneVisibility';
import {
  compileOpaqueCubeFaceOcclusion,
  type CubeFaceOcclusion
} from './cubeFaceOcclusion';

export interface MinecraftGeometryFaceUv {
  uv: [number, number];
  uv_size: [number, number];
  uv_rotation?: 90 | 180 | 270;
  material_instance?: string;
}

export interface MinecraftGeometryCube {
  origin: [number, number, number];
  size: [number, number, number];
  inflate?: number;
  pivot?: [number, number, number];
  rotation?: [number, number, number];
  uv: [number, number] | Partial<Record<CubeFaceDirection, MinecraftGeometryFaceUv>>;
  mirror?: boolean;
}

export interface MinecraftGeometryLocatorTransform {
  offset: [number, number, number];
  rotation: [number, number, number];
  ignore_inherited_scale?: boolean;
}

export type MinecraftGeometryLocator =
  | [number, number, number]
  | MinecraftGeometryLocatorTransform;

export interface MinecraftGeometryBone {
  name: string;
  parent?: string;
  pivot?: [number, number, number];
  rotation?: [number, number, number];
  mirror?: boolean;
  inflate?: number;
  cubes?: MinecraftGeometryCube[];
  locators?: Record<string, MinecraftGeometryLocator>;
}

export interface MinecraftGeometryFile {
  format_version: string;
  'minecraft:geometry': Array<{
    description: {
      identifier: string;
      texture_width: number;
      texture_height: number;
      visible_bounds_width?: number;
      visible_bounds_height?: number;
      visible_bounds_offset?: [number, number, number];
    };
    bones: MinecraftGeometryBone[];
  }>;
}

export interface MinecraftGeometryCompileOptions {
  formatVersion: string;
  identifier: string;
  visibleBounds?: {
    width: number;
    height: number;
    offset: Vec3;
  };
}

const NO_OCCLUDED_FACES: ReadonlySet<CubeFaceDirection> = new Set();

const addPosition = (value: Vec3, position: Vec3): [number, number, number] => [
  value[0] + position[0],
  value[1] + position[1],
  value[2] + position[2]
];

const negate = (value: number): number => (Math.abs(value) <= 0.000001 ? 0 : -value);

const compileFaceUv = (
  cube: CubeNode,
  occluded: ReadonlySet<CubeFaceDirection>
): Partial<Record<CubeFaceDirection, MinecraftGeometryFaceUv>> => {
  const uv: Partial<Record<CubeFaceDirection, MinecraftGeometryFaceUv>> = {};
  for (const direction of CUBE_FACE_DIRECTIONS) {
    const face = cube.faces[direction];
    if (!face.enabled || !face.uv || occluded.has(direction)) continue;
    const entry: MinecraftGeometryFaceUv = {
      uv: [face.uv[0], face.uv[1]],
      uv_size: [face.uv[2] - face.uv[0], face.uv[3] - face.uv[1]],
      ...(face.rotation ? { uv_rotation: face.rotation } : {}),
      ...(face.materialInstance ? { material_instance: face.materialInstance } : {})
    };
    if (direction === 'up' || direction === 'down') {
      entry.uv[0] += entry.uv_size[0];
      entry.uv[1] += entry.uv_size[1];
      entry.uv_size[0] *= -1;
      entry.uv_size[1] *= -1;
    }
    uv[direction] = entry;
  }
  return uv;
};

const compileCube = (
  cube: CubeNode,
  occlusion: CubeFaceOcclusion
): MinecraftGeometryCube => {
  const from = addPosition(cube.bounds.from, cube.transform.position);
  const to = addPosition(cube.bounds.to, cube.transform.position);
  const size: [number, number, number] = [
    to[0] - from[0],
    to[1] - from[1],
    to[2] - from[2]
  ];
  const rotation = cube.transform.rotation;
  const hasRotation = rotation.some((value) => Math.abs(value) > 0.000001);

  return {
    origin: [negate(to[0]), from[1], from[2]],
    size,
    ...(cube.inflate ? { inflate: cube.inflate } : {}),
    ...(hasRotation
      ? {
          pivot: [
            negate(cube.transform.pivot[0] + cube.transform.position[0]),
            cube.transform.pivot[1] + cube.transform.position[1],
            cube.transform.pivot[2] + cube.transform.position[2]
          ],
          rotation: [negate(rotation[0]), negate(rotation[1]), rotation[2]]
        }
      : {}),
    uv: cube.boxUv
      ? [cube.uvOffset?.[0] ?? 0, cube.uvOffset?.[1] ?? 0]
      : compileFaceUv(cube, occlusion.get(cube.id) ?? NO_OCCLUDED_FACES),
    ...(cube.boxUv && cube.mirror ? { mirror: true } : {})
  };
};

const compileLocator = (
  locator: LocatorNode
): MinecraftGeometryLocatorTransform => ({
  offset: [
    negate(locator.transform.position[0]),
    locator.transform.position[1],
    locator.transform.position[2]
  ],
  rotation: [
    negate(locator.transform.rotation[0]),
    negate(locator.transform.rotation[1]),
    locator.transform.rotation[2]
  ],
  ...(locator.ignoreInheritedScale
    ? { ignore_inherited_scale: true }
    : {})
});

const compileCompactLocator = (
  locator: LocatorNode
): MinecraftGeometryLocator => {
  const compiled = compileLocator(locator);
  return compiled.rotation.every((value) => Math.abs(value) <= 0.000001) &&
    !compiled.ignore_inherited_scale
    ? compiled.offset
    : compiled;
};

const factorCubeDefaults = (
  cubes: readonly MinecraftGeometryCube[]
): {
  cubes: MinecraftGeometryCube[];
  mirror?: boolean;
  inflate?: number;
} => {
  const factorMirror = cubes.length > 1 && cubes.every(
    (cube) => cube.mirror === true
  );
  const inflate = cubes[0]?.inflate ?? 0;
  const factorInflate = cubes.length > 1 && inflate !== 0 && cubes.every(
    (cube) => (cube.inflate ?? 0) === inflate
  );
  return {
    cubes: cubes.map((cube) => {
      const compact = { ...cube };
      if (factorMirror) delete compact.mirror;
      if (factorInflate) delete compact.inflate;
      return compact;
    }),
    ...(factorMirror ? { mirror: true } : {}),
    ...(factorInflate ? { inflate } : {})
  };
};

const compileBone = (
  document: ProjectDocument,
  bone: BoneNode,
  visibleNodeIds: ReadonlySet<string>,
  occlusion: CubeFaceOcclusion
): MinecraftGeometryBone => {
  const parent =
    bone.parentId === null ? undefined : document.scene.nodes[bone.parentId];
  const cubes = Object.values(document.scene.nodes)
    .filter(
      (node): node is CubeNode =>
        node.kind === 'cube' &&
        visibleNodeIds.has(node.id) &&
        node.parentId === bone.id
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((cube) => compileCube(cube, occlusion));
  const factored = factorCubeDefaults(cubes);
  const locatorEntries = Object.values(document.scene.nodes)
    .filter(
      (node): node is LocatorNode =>
        node.kind === 'locator' &&
        visibleNodeIds.has(node.id) &&
        node.parentId === bone.id
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((locator) => [locator.name, compileCompactLocator(locator)] as const);
  const rotation = bone.transform.rotation;
  const hasRotation = rotation.some((value) => Math.abs(value) > 0.000001);

  return {
    name: bone.name,
    ...(parent?.kind === 'bone' ? { parent: parent.name } : {}),
    ...(bone.transform.pivot.some((value) => Math.abs(value) > 0.000001)
      ? {
          pivot: [
            negate(bone.transform.pivot[0]),
            bone.transform.pivot[1],
            bone.transform.pivot[2]
          ] as [number, number, number]
        }
      : {}),
    ...(hasRotation
      ? {
          rotation: [negate(rotation[0]), negate(rotation[1]), rotation[2]]
        }
      : {}),
    ...(factored.mirror ? { mirror: factored.mirror } : {}),
    ...(factored.inflate !== undefined ? { inflate: factored.inflate } : {}),
    ...(factored.cubes.length > 0 ? { cubes: factored.cubes } : {}),
    ...(locatorEntries.length > 0
      ? { locators: Object.fromEntries(locatorEntries) }
      : {})
  };
};

const createLooseBone = (
  document: ProjectDocument,
  visibleNodeIds: ReadonlySet<string>,
  occlusion: CubeFaceOcclusion
): MinecraftGeometryBone | null => {
  const looseCubes = Object.values(document.scene.nodes)
    .filter(
      (node): node is CubeNode =>
        node.kind === 'cube' &&
        visibleNodeIds.has(node.id) &&
        node.parentId === null
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((cube) => compileCube(cube, occlusion));
  if (looseCubes.length === 0) return null;
  const factored = factorCubeDefaults(looseCubes);
  return {
    name: 'ashfox_root',
    ...(factored.mirror ? { mirror: factored.mirror } : {}),
    ...(factored.inflate !== undefined ? { inflate: factored.inflate } : {}),
    cubes: factored.cubes
  };
};

export const buildMinecraftGeometry = (
  document: ProjectDocument,
  options: MinecraftGeometryCompileOptions
): MinecraftGeometryFile => {
  const visibleNodeIds =
    effectivelyVisibleSceneNodeIds(document);
  const occlusion = compileOpaqueCubeFaceOcclusion(document, {
    groupLooseCubes: true
  });
  const bones = Object.values(document.scene.nodes)
    .filter(
      (node): node is BoneNode =>
        node.kind === 'bone' && visibleNodeIds.has(node.id)
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((bone) => compileBone(document, bone, visibleNodeIds, occlusion));
  const looseBone = createLooseBone(document, visibleNodeIds, occlusion);
  if (looseBone) bones.unshift(looseBone);

  return {
    format_version: options.formatVersion,
    'minecraft:geometry': [
      {
        description: {
          identifier: options.identifier,
          texture_width: document.settings.textureResolution.width,
          texture_height: document.settings.textureResolution.height,
          ...(options.visibleBounds
            ? {
                visible_bounds_width: options.visibleBounds.width,
                visible_bounds_height: options.visibleBounds.height,
                visible_bounds_offset: [
                  options.visibleBounds.offset[0],
                  options.visibleBounds.offset[1],
                  options.visibleBounds.offset[2]
                ]
              }
            : {})
        },
        bones
      }
    ]
  };
};
