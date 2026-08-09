import {
  CUBE_FACE_DIRECTIONS,
  IDENTITY_TRANSFORM,
  type BoneNode,
  type CubeNode,
  type ProjectDocument,
  type SceneNode,
  type Vec3
} from '../../model';
import { compareStableText } from '../../stableOrder';
import { createGeneratedCubeFaces } from '../../textures/generatedMaterial';
import { latticeToWorld } from '../lattice';
import type { GeometryPartSpec } from './index';
import {
  compiledPartBoneId,
  compiledPartCubeId,
  compiledPartGeneration,
  isCompiledPartNode
} from '../provenance';
import type { SurfaceOwnedCuboid } from '../surface/ownership';
import type { Cuboid, LatticePoint } from '../contract';

const worldPoint = (
  value: readonly [number, number, number],
  density: 1 | 2 | 4
): Vec3 => [
  latticeToWorld(value[0], density),
  latticeToWorld(value[1], density),
  latticeToWorld(value[2], density)
];

export const partBoneNode = (
  part: GeometryPartSpec,
  density: 1 | 2 | 4,
  canonicalAttachmentAnchor: LatticePoint | null
): BoneNode => ({
  id: compiledPartBoneId(part.partId),
  kind: 'bone',
  name: part.partId,
  parentId: part.parentPartId === null
    ? null : compiledPartBoneId(part.parentPartId),
  transform: {
    ...IDENTITY_TRANSFORM,
    pivot: canonicalAttachmentAnchor === null
      ? IDENTITY_TRANSFORM.pivot
      : worldPoint([
          canonicalAttachmentAnchor.x,
          canonicalAttachmentAnchor.y,
          canonicalAttachmentAnchor.z
        ], density)
  },
  visible: true,
  generation: compiledPartGeneration({
    partId: part.partId,
    parentPartId: part.parentPartId,
    materialId: part.materialId,
    primitive: part.kind,
    joint: part.joint
  }, 'bone')
});

export const partCubeNode = (
  document: ProjectDocument,
  part: GeometryPartSpec,
  cuboid: Cuboid,
  surface: SurfaceOwnedCuboid['faces'],
  baseColor: string,
  textureId: string
): CubeNode => {
  const density = document.settings.surfacePixelDensity;
  const texture = document.textures[textureId];
  const generatedFaces = createGeneratedCubeFaces(
    textureId, texture.width, texture.height
  );
  const candidate: CubeNode = {
    id: compiledPartCubeId(part.partId, density, cuboid.bounds),
    kind: 'cube',
    name: part.partId,
    parentId: compiledPartBoneId(part.partId),
    transform: IDENTITY_TRANSFORM,
    visible: true,
    generation: compiledPartGeneration({
      partId: part.partId,
      parentPartId: part.parentPartId,
      materialId: part.materialId,
      primitive: part.kind,
      joint: part.joint
    }, 'geometry'),
    bounds: {
      from: [
        latticeToWorld(cuboid.bounds.min.x, density),
        latticeToWorld(cuboid.bounds.min.y, density),
        latticeToWorld(cuboid.bounds.min.z, density)
      ],
      to: [
        latticeToWorld(cuboid.bounds.max.x, density),
        latticeToWorld(cuboid.bounds.max.y, density),
        latticeToWorld(cuboid.bounds.max.z, density)
      ]
    },
    inflate: 0,
    mirror: false,
    boxUv: false,
    baseColor,
    faces: Object.fromEntries(CUBE_FACE_DIRECTIONS.map((direction) => [
      direction,
      {
        ...generatedFaces[direction],
        enabled: surface[direction] === 'external'
      }
    ])) as CubeNode['faces']
  };
  const existing = document.scene.nodes[candidate.id];
  if (
    existing?.kind !== 'cube' ||
    !CUBE_FACE_DIRECTIONS.every((direction) =>
      existing.faces[direction].enabled === candidate.faces[direction].enabled) ||
    !Object.values(existing.faces).every((face) => face.textureId === textureId)
  ) return candidate;
  const reused: CubeNode = { ...candidate, faces: existing.faces };
  return JSON.stringify(reused) === JSON.stringify(existing)
    ? existing : candidate;
};

export const appendPartSceneNodes = (
  document: ProjectDocument,
  nodes: readonly SceneNode[]
): ProjectDocument => ({
  ...document,
  scene: {
    roots: [...new Set([
      ...document.scene.roots,
      ...nodes.filter((node) => node.parentId === null).map((node) => node.id)
    ])].sort(compareStableText),
    nodes: Object.fromEntries([
      ...Object.values(document.scene.nodes),
      ...nodes
    ].sort((left, right) => compareStableText(left.id, right.id))
      .map((node) => [node.id, node]))
  }
});

export const foreignSceneNodeCollision = (
  document: ProjectDocument,
  nodes: readonly SceneNode[]
): string | null => nodes.find((node) => {
  const current = document.scene.nodes[node.id];
  return current !== undefined && !isCompiledPartNode(current);
})?.id ?? null;
