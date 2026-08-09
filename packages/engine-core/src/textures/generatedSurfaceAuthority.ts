import {
  CUBE_FACE_DIRECTIONS,
  type CubeFaceDirection,
  type CubeNode,
  type ModelFeaturePartSpec,
  type ProjectDocument
} from '../model';
import {
  cellKey,
  worldToLattice
} from '../modeling/lattice';
import {
  classifySurfaceFace
} from '../modeling/surfaceOwnership';
import {
  PART_CONTRACT_LIMITS
} from '../modeling/partContract';
import type { EyeFeaturePartSpec } from '../modeling/partContract';
import {
  centeredEyePupilBias
} from '../modeling/eyeGaze';
import type { EyePupilBias } from '../modeling/eyeGlyph';
import {
  readPartRecipe
} from '../modeling/partRecipe';
import {
  orientedSurfaceFeatureRect,
  surfaceFeaturePlane
} from '../modeling/surfaceFeature';
import type {
  CellKey,
  LatticeBounds
} from '../modeling/types';
import {
  buildSurfacePatternComponents
} from './surfacePatternComponents';
import type {
  SurfacePatternComponent
} from './surfacePatternComponents';
import {
  buildGeneratedSurfaceToneField,
  type GeneratedSurfaceToneField,
  type GeneratedSurfaceTonePolicy
} from './generatedToneField';

export type { GeneratedSurfaceTonePolicy } from './generatedToneField';

export interface GeneratedSurfacePattern {
  seedKey: string;
  tonePolicy: GeneratedSurfaceTonePolicy;
  toneField: GeneratedSurfaceToneField;
  origin: readonly [number, number];
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface GeneratedSurfaceMarking {
  id: string;
  motif: ModelFeaturePartSpec['motif'];
  glyph?: ModelFeaturePartSpec['glyph'];
  eyePupilBias?: EyePupilBias;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  motifX: number;
  motifY: number;
  motifWidth: number;
  motifHeight: number;
}

export interface CompiledFaceAuthority {
  external: boolean;
  tonePolicy: GeneratedSurfaceTonePolicy;
  pattern?: GeneratedSurfacePattern;
  markings?: readonly GeneratedSurfaceMarking[];
}

export interface CompiledSurfaceAuthority {
  faces: ReadonlyMap<string, CompiledFaceAuthority>;
  nodeIds: ReadonlySet<string>;
}

export interface GeneratedSurfaceGrid {
  texelsPerModelUnit: number;
  faceSize: (
    cube: CubeNode,
    direction: CubeFaceDirection
  ) => { width: number; height: number } | null;
}

interface PatternDraft {
  faceKey: string;
  groupKey: string;
  tonePolicy: GeneratedSurfaceTonePolicy;
  origin: readonly [number, number];
  width: number;
  height: number;
}

interface SurfaceFeatureContext {
  colors: ReadonlyMap<string, string>;
  features: readonly ModelFeaturePartSpec[];
  focalHostKeys: ReadonlySet<string>;
}

export const generatedSurfaceFaceKey = (
  nodeId: string,
  direction: CubeFaceDirection
): string => `${nodeId}:${direction}`;

const surfaceHostKey = (
  partId: string,
  face: CubeFaceDirection,
  plane: number
): string => JSON.stringify([partId, face, plane]);

const readSurfaceFeatureContext = (
  document: ProjectDocument
): SurfaceFeatureContext => {
  const result = readPartRecipe(document);
  if (!result.ok || result.recipe === null) {
    return {
      colors: new Map(),
      features: [],
      focalHostKeys: new Set()
    };
  }
  const features = result.recipe.parts
    .filter(
      (part): part is ModelFeaturePartSpec => part.kind === 'feature'
    )
    .sort((left, right) => left.partId.localeCompare(right.partId));
  return {
    colors: new Map(result.recipe.materials.map((material) => [
      material.id,
      material.baseColor
    ])),
    features,
    focalHostKeys: new Set(
      features
        .flatMap((feature) =>
          feature.motif === 'patch' || feature.parentPartId === null
            ? []
            : [surfaceHostKey(
                feature.parentPartId,
                feature.face,
                surfaceFeaturePlane(feature)
              )]
        )
    )
  };
};

const compiledLatticeBounds = (
  document: ProjectDocument,
  cube: CubeNode
): LatticeBounds | null => {
  try {
    const density = document.settings.surfacePixelDensity;
    return {
      min: {
        x: worldToLattice(cube.bounds.from[0], density),
        y: worldToLattice(cube.bounds.from[1], density),
        z: worldToLattice(cube.bounds.from[2], density)
      },
      max: {
        x: worldToLattice(cube.bounds.to[0], density),
        y: worldToLattice(cube.bounds.to[1], density),
        z: worldToLattice(cube.bounds.to[2], density)
      }
    };
  } catch {
    return null;
  }
};

const boundsVolume = (bounds: LatticeBounds): number =>
  (bounds.max.x - bounds.min.x) *
  (bounds.max.y - bounds.min.y) *
  (bounds.max.z - bounds.min.z);

const addBoundsCells = (
  bounds: LatticeBounds,
  occupancy: Set<string>
): void => {
  for (let x = bounds.min.x; x < bounds.max.x; x += 1) {
    for (let y = bounds.min.y; y < bounds.max.y; y += 1) {
      for (let z = bounds.min.z; z < bounds.max.z; z += 1) {
        occupancy.add(cellKey({ x, y, z }));
      }
    }
  }
};

const facePlane = (
  bounds: LatticeBounds,
  direction: CubeFaceDirection
): number => {
  switch (direction) {
    case 'north':
      return bounds.min.z;
    case 'south':
      return bounds.max.z;
    case 'east':
      return bounds.max.x;
    case 'west':
      return bounds.min.x;
    case 'up':
      return bounds.max.y;
    case 'down':
      return bounds.min.y;
  }
};

const patternOrigin = (
  cube: CubeNode,
  direction: CubeFaceDirection,
  texelsPerModelUnit: number
): readonly [number, number] => {
  const from = cube.bounds.from.map((value) =>
    Math.round(value * texelsPerModelUnit)
  );
  const to = cube.bounds.to.map((value) =>
    Math.round(value * texelsPerModelUnit)
  );
  switch (direction) {
    case 'north':
      return [1 - to[0], 1 - to[1]];
    case 'south':
      return [from[0], 1 - to[1]];
    case 'east':
      return [1 - to[2], 1 - to[1]];
    case 'west':
      return [from[2], 1 - to[1]];
    case 'up':
      return [from[0], from[2]];
    case 'down':
      return [from[0], 1 - to[2]];
  }
};

const emptyAuthority = (
  nodeIds: ReadonlySet<string> = new Set()
): CompiledSurfaceAuthority => ({
  faces: new Map(),
  nodeIds
});

const intersection = (
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number }
): { x: number; y: number; width: number; height: number } | null => {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const maximumX = Math.min(left.x + left.width, right.x + right.width);
  const maximumY = Math.min(left.y + left.height, right.y + right.height);
  return maximumX <= x || maximumY <= y
    ? null
    : { x, y, width: maximumX - x, height: maximumY - y };
};

const addSurfaceFeatureMarkings = (
  document: ProjectDocument,
  context: SurfaceFeatureContext,
  cubes: readonly CubeNode[],
  boundsByNode: ReadonlyMap<string, LatticeBounds>,
  grid: GeneratedSurfaceGrid,
  faces: Map<string, CompiledFaceAuthority>
): void => {
  for (const feature of context.features) {
    const featureRect = orientedSurfaceFeatureRect(feature);
    const plane = surfaceFeaturePlane(feature);
    const color = context.colors.get(feature.materialId);
    if (!color) continue;
    for (const cube of cubes) {
      if (cube.generation?.partId !== feature.parentPartId) continue;
      const bounds = boundsByNode.get(cube.id);
      const size = grid.faceSize(cube, feature.face);
      const key = generatedSurfaceFaceKey(cube.id, feature.face);
      const authority = faces.get(key);
      if (
        !bounds ||
        !size ||
        !authority?.external ||
        facePlane(bounds, feature.face) !== plane
      ) {
        continue;
      }
      const faceOrigin = patternOrigin(
        cube,
        feature.face,
        grid.texelsPerModelUnit
      );
      const faceRect = {
        x: faceOrigin[0],
        y: faceOrigin[1],
        width: size.width,
        height: size.height
      };
      const clipped = intersection(featureRect, faceRect);
      if (!clipped) continue;
      const marking: GeneratedSurfaceMarking = {
        id: feature.partId,
        motif: feature.motif,
        ...(feature.glyph === undefined ? {} : { glyph: feature.glyph }),
        ...(feature.motif === 'eye' && document.intent
          ? {
              eyePupilBias: centeredEyePupilBias(
                document.intent,
                feature as EyeFeaturePartSpec
              )
            }
          : {}),
        color,
        x: clipped.x - faceRect.x,
        y: clipped.y - faceRect.y,
        width: clipped.width,
        height: clipped.height,
        motifX: clipped.x - featureRect.x,
        motifY: clipped.y - featureRect.y,
        motifWidth: featureRect.width,
        motifHeight: featureRect.height
      };
      faces.set(key, {
        ...authority,
        markings: [
          ...(authority.markings ?? []),
          marking
        ]
      });
    }
  }
};

export const buildCompiledSurfaceAuthority = (
  document: ProjectDocument,
  grid: GeneratedSurfaceGrid
): CompiledSurfaceAuthority => {
  const cubes = Object.values(document.scene.nodes).filter(
    (node): node is CubeNode =>
      node.kind === 'cube' &&
      node.generation?.authority === 'ashfox.part-compiler' &&
      node.generation.role === 'geometry'
  );
  if (cubes.length === 0) return emptyAuthority();
  const nodeIds = new Set(cubes.map((cube) => cube.id));
  const featureContext = readSurfaceFeatureContext(document);

  const boundsByNode = new Map<string, LatticeBounds>();
  const occupancy = new Set<CellKey>();
  let cellCount = 0;
  for (const cube of cubes) {
    const bounds = compiledLatticeBounds(document, cube);
    if (!bounds) return emptyAuthority(nodeIds);
    const spans = [
      bounds.max.x - bounds.min.x,
      bounds.max.y - bounds.min.y,
      bounds.max.z - bounds.min.z
    ];
    const volume = boundsVolume(bounds);
    if (
      spans.some(
        (span) =>
          span <= 0 ||
          span > PART_CONTRACT_LIMITS.maxAxisSpan
      ) ||
      !Number.isSafeInteger(volume) ||
      cellCount + volume >
        PART_CONTRACT_LIMITS.maxOccupancyCellsPerDocument
    ) {
      return emptyAuthority(nodeIds);
    }
    cellCount += volume;
    boundsByNode.set(cube.id, bounds);
    addBoundsCells(bounds, occupancy);
  }

  const faces = new Map<string, CompiledFaceAuthority>();
  const drafts: PatternDraft[] = [];
  for (const cube of cubes) {
    const bounds = boundsByNode.get(cube.id);
    const generation = cube.generation;
    if (!bounds || !generation) continue;
    for (const direction of CUBE_FACE_DIRECTIONS) {
      const key = generatedSurfaceFaceKey(cube.id, direction);
      const external =
        classifySurfaceFace(bounds, direction, occupancy) === 'external';
      const plane = facePlane(bounds, direction);
      const tonePolicy: GeneratedSurfaceTonePolicy =
        featureContext.focalHostKeys.has(
          surfaceHostKey(generation.partId, direction, plane)
        )
          ? 'focal'
          : 'regular';
      faces.set(key, { external, tonePolicy });
      if (!external) continue;
      const size = grid.faceSize(cube, direction);
      if (!size) continue;
      const groupKey = [
        generation.materialId,
        direction,
        plane,
        tonePolicy
      ].join(':');
      drafts.push({
        faceKey: key,
        groupKey,
        tonePolicy,
        origin: patternOrigin(
          cube,
          direction,
          grid.texelsPerModelUnit
        ),
        width: size.width,
        height: size.height
      });
    }
  }

  const components = buildSurfacePatternComponents(
    drafts.map((draft) => ({
      id: draft.faceKey,
      groupKey: draft.groupKey,
      x: draft.origin[0],
      y: draft.origin[1],
      width: draft.width,
      height: draft.height
    }))
  );
  const toneFields = new Map<
    SurfacePatternComponent,
    GeneratedSurfaceToneField
  >();
  for (const draft of drafts) {
    const component = components.get(draft.faceKey);
    if (!component) continue;
    const toneField = toneFields.get(component) ??
      buildGeneratedSurfaceToneField(component, draft.tonePolicy);
    toneFields.set(component, toneField);
    faces.set(draft.faceKey, {
      external: true,
      tonePolicy: draft.tonePolicy,
      pattern: {
        seedKey: component.seedKey,
        tonePolicy: draft.tonePolicy,
        toneField,
        origin: draft.origin,
        bounds: component.bounds
      }
    });
  }
  addSurfaceFeatureMarkings(
    document,
    featureContext,
    cubes,
    boundsByNode,
    grid,
    faces
  );
  return { faces, nodeIds };
};

export const effectiveGeneratedFaceEnabled = (
  node: CubeNode,
  direction: CubeFaceDirection,
  authority: CompiledSurfaceAuthority
): boolean =>
  authority.faces.get(
    generatedSurfaceFaceKey(node.id, direction)
  )?.external ?? node.faces[direction].enabled;
