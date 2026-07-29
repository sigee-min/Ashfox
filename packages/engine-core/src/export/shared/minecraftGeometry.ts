import {
  CUBE_FACE_DIRECTIONS,
  type BoneNode,
  type CubeFaceDirection,
  type CubeNode,
  type LocatorNode,
  type ProjectDocument,
  type Vec3
} from '../../model';

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

export interface MinecraftGeometryLocator {
  offset: [number, number, number];
  rotation: [number, number, number];
  ignore_inherited_scale?: boolean;
}

export interface MinecraftGeometryBone {
  name: string;
  parent?: string;
  pivot: [number, number, number];
  rotation?: [number, number, number];
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

const addPosition = (value: Vec3, position: Vec3): [number, number, number] => [
  value[0] + position[0],
  value[1] + position[1],
  value[2] + position[2]
];

const negate = (value: number): number => (Math.abs(value) <= 0.000001 ? 0 : -value);

const compileFaceUv = (
  cube: CubeNode
): Partial<Record<CubeFaceDirection, MinecraftGeometryFaceUv>> => {
  const uv: Partial<Record<CubeFaceDirection, MinecraftGeometryFaceUv>> = {};
  for (const direction of CUBE_FACE_DIRECTIONS) {
    const face = cube.faces[direction];
    if (!face.enabled || !face.uv) continue;
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

const compileCube = (cube: CubeNode): MinecraftGeometryCube => {
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
      : compileFaceUv(cube),
    ...(cube.boxUv && cube.mirror ? { mirror: true } : {})
  };
};

const compileLocator = (locator: LocatorNode): MinecraftGeometryLocator => ({
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

const compileBone = (
  document: ProjectDocument,
  bone: BoneNode
): MinecraftGeometryBone => {
  const parent =
    bone.parentId === null ? undefined : document.scene.nodes[bone.parentId];
  const cubes = Object.values(document.scene.nodes)
    .filter(
      (node): node is CubeNode =>
        node.kind === 'cube' && node.visible && node.parentId === bone.id
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(compileCube);
  const locatorEntries = Object.values(document.scene.nodes)
    .filter(
      (node): node is LocatorNode =>
        node.kind === 'locator' && node.visible && node.parentId === bone.id
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((locator) => [locator.name, compileLocator(locator)] as const);
  const rotation = bone.transform.rotation;
  const hasRotation = rotation.some((value) => Math.abs(value) > 0.000001);

  return {
    name: bone.name,
    ...(parent?.kind === 'bone' ? { parent: parent.name } : {}),
    pivot: [
      negate(bone.transform.pivot[0]),
      bone.transform.pivot[1],
      bone.transform.pivot[2]
    ],
    ...(hasRotation
      ? {
          rotation: [negate(rotation[0]), negate(rotation[1]), rotation[2]]
        }
      : {}),
    ...(cubes.length > 0 ? { cubes } : {}),
    ...(locatorEntries.length > 0
      ? { locators: Object.fromEntries(locatorEntries) }
      : {})
  };
};

const createLooseBone = (document: ProjectDocument): MinecraftGeometryBone | null => {
  const looseCubes = Object.values(document.scene.nodes)
    .filter(
      (node): node is CubeNode =>
        node.kind === 'cube' && node.visible && node.parentId === null
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(compileCube);
  if (looseCubes.length === 0) return null;
  return {
    name: 'ashfox_root',
    pivot: [0, 0, 0],
    cubes: looseCubes
  };
};

export const buildMinecraftGeometry = (
  document: ProjectDocument,
  options: MinecraftGeometryCompileOptions
): MinecraftGeometryFile => {
  const bones = Object.values(document.scene.nodes)
    .filter((node): node is BoneNode => node.kind === 'bone' && node.visible)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((bone) => compileBone(document, bone));
  const looseBone = createLooseBone(document);
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
