import type {
  GeneratedNodeProvenance,
  ModelGeometryPrimitive,
  SceneNode,
  SurfacePixelDensity
} from '../model';
import type { PartJoint } from './partContract';
import type { LatticeBounds } from './types';
import { stableBoundsKey } from './lattice';

export interface CompiledPartProvenance {
  partId: string;
  parentPartId: string | null;
  materialId: string;
  primitive: ModelGeometryPrimitive;
  joint: PartJoint;
}

export const compiledPartGeneration = (
  provenance: CompiledPartProvenance,
  role: GeneratedNodeProvenance['role']
): GeneratedNodeProvenance => ({
  authority: 'ashfox.part-compiler',
  role,
  ...provenance
});

export const isCompiledPartNode = (node: SceneNode): boolean =>
  node.generation?.authority === 'ashfox.part-compiler';

export const compiledPartProvenance = (
  node: SceneNode
): CompiledPartProvenance | null => {
  const generation = node.generation;
  if (generation?.authority !== 'ashfox.part-compiler') return null;
  return {
    partId: generation.partId,
    parentPartId: generation.parentPartId,
    materialId: generation.materialId,
    primitive: generation.primitive,
    joint: generation.joint
  };
};

export const compiledPartBoneId = (partId: string): string =>
  `bone:${partId}`;

export const compiledPartCubeId = (
  partId: string,
  density: SurfacePixelDensity,
  bounds: LatticeBounds
): string =>
  `cube:${partId}:${stableBoundsKey(density, bounds)}`;
