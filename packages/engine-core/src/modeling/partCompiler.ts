import {
  IDENTITY_TRANSFORM,
  type BoneNode,
  type CubeNode,
  type ProjectDocument,
  type SceneNode,
  type Vec3
} from '../model';
import {
  createGeneratedCubeFaces
} from '../textures/generatedMaterial';
import { compareStableText } from '../stableOrder';
import {
  readCompiledParts,
  type CompiledPartState,
  type PartInvariantIssue
} from './partInvariants';
import {
  type GeometryPartSpec,
  type PartMaterialDefinition,
  type PartSpec
} from './partContract';
import {
  canonicalizePartOccupancies
} from './partOccupancyCanonicalization';
import {
  compiledPartBoneId,
  compiledPartCubeId,
  compiledPartGeneration,
  isCompiledPartNode
} from './provenance';
import {
  latticeToWorld
} from './lattice';
import type {
  Cuboid,
  LatticePoint
} from './types';

export interface CompilePartSceneInput {
  parts: readonly PartSpec[];
  materials: readonly PartMaterialDefinition[];
  textureId: string;
}

export interface CompilePartSceneSuccess {
  ok: true;
  document: ProjectDocument;
  projectedParts: readonly PartSpec[];
  createdIds: readonly string[];
  changedIds: readonly string[];
  removedIds: readonly string[];
}

export interface CompilePartSceneFailure {
  ok: false;
  code:
    | 'invalid_existing_model'
    | 'missing_parent'
    | 'missing_material'
    | 'id_collision'
    | 'geometry';
  path: string;
  pathScope: 'payload' | 'document';
  message: string;
  issues?: readonly PartInvariantIssue[];
}

export type CompilePartSceneResult =
  | CompilePartSceneSuccess
  | CompilePartSceneFailure;

const failure = (
  code: CompilePartSceneFailure['code'],
  path: string,
  message: string,
  issues?: readonly PartInvariantIssue[],
  pathScope: CompilePartSceneFailure['pathScope'] =
    path.startsWith('scene.') ? 'document' : 'payload'
): CompilePartSceneFailure => ({
  ok: false,
  code,
  path,
  pathScope,
  message,
  ...(issues ? { issues } : {})
});

const materialColors = (
  existingParts: ReadonlyMap<string, CompiledPartState>,
  inputs: readonly PartMaterialDefinition[],
  replacedPartIds: ReadonlySet<string>
):
  | {
      ok: true;
      colors: ReadonlyMap<string, string>;
    }
  | CompilePartSceneFailure => {
  const colors = new Map<string, string>();
  for (const part of existingParts.values()) {
    if (replacedPartIds.has(part.partId)) continue;
    const color = part.cubes[0]?.baseColor;
    if (!color) continue;
    const existing = colors.get(part.materialId);
    if (existing && existing.toLowerCase() !== color.toLowerCase()) {
      return failure(
        'invalid_existing_model',
        `scene.parts.${part.partId}.materialId`,
        `Material "${part.materialId}" has conflicting base colors.`
      );
    }
    colors.set(part.materialId, color);
  }
  for (const input of inputs) {
    const existing = colors.get(input.id);
    if (existing && existing.toLowerCase() !== input.baseColor.toLowerCase()) {
      return failure(
        'geometry',
        `materials.${input.id}`,
        'Use model.parts.material to change an existing material color.'
      );
    }
    colors.set(input.id, input.baseColor);
  }
  return { ok: true, colors };
};

const withoutReplacedParts = (
  document: ProjectDocument,
  replacedPartIds: ReadonlySet<string>
): {
  document: ProjectDocument;
  removedIds: readonly string[];
} => {
  const removedIds = Object.values(document.scene.nodes)
    .filter(
      (node) =>
        isCompiledPartNode(node) &&
        node.generation !== undefined &&
        replacedPartIds.has(node.generation.partId)
    )
    .map((node) => node.id)
    .sort(compareStableText);
  const removed = new Set(removedIds);
  return {
    document: {
      ...document,
      scene: {
        roots: document.scene.roots.filter(
          (nodeId) => !removed.has(nodeId)
        ),
        nodes: Object.fromEntries(
          Object.entries(document.scene.nodes).filter(
            ([nodeId]) => !removed.has(nodeId)
          )
        )
      }
    },
    removedIds
  };
};

const worldPoint = (
  value: readonly [number, number, number],
  density: 1 | 2 | 4
): Vec3 => [
  latticeToWorld(value[0], density),
  latticeToWorld(value[1], density),
  latticeToWorld(value[2], density)
];

const boneForPart = (
  part: GeometryPartSpec,
  density: 1 | 2 | 4,
  canonicalAttachmentAnchor: LatticePoint | null
): BoneNode => {
  const provenance = {
    partId: part.partId,
    parentPartId: part.parentPartId,
    materialId: part.materialId,
    primitive: part.kind,
    joint: part.joint
  };
  return {
    id: compiledPartBoneId(part.partId),
    kind: 'bone',
    name: part.partId,
    parentId:
      part.parentPartId === null
        ? null
        : compiledPartBoneId(part.parentPartId),
    transform: {
      ...IDENTITY_TRANSFORM,
      pivot:
        canonicalAttachmentAnchor === null
          ? IDENTITY_TRANSFORM.pivot
          : worldPoint([
              canonicalAttachmentAnchor.x,
              canonicalAttachmentAnchor.y,
              canonicalAttachmentAnchor.z
            ], density)
    },
    visible: true,
    generation: compiledPartGeneration(provenance, 'bone')
  };
};

const cubeForCuboid = (
  document: ProjectDocument,
  part: GeometryPartSpec,
  cuboid: Cuboid,
  baseColor: string,
  textureId: string
): CubeNode => {
  const density = document.settings.surfacePixelDensity;
  const texture = document.textures[textureId];
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
    faces: createGeneratedCubeFaces(
      textureId,
      texture.width,
      texture.height
    )
  };
  const existing = document.scene.nodes[candidate.id];
  if (
    existing?.kind !== 'cube' ||
    !Object.values(existing.faces).every(
      (face) => face.textureId === textureId
    )
  ) {
    return candidate;
  }
  const withExistingFaces: CubeNode = {
    ...candidate,
    faces: existing.faces
  };
  return JSON.stringify(withExistingFaces) === JSON.stringify(existing)
    ? existing
    : candidate;
};

const addNodes = (
  document: ProjectDocument,
  nodes: readonly SceneNode[]
): ProjectDocument => ({
  ...document,
  scene: {
    roots: [
      ...new Set([
        ...document.scene.roots,
        ...nodes
          .filter((node) => node.parentId === null)
          .map((node) => node.id)
      ])
    ].sort(compareStableText),
    nodes: Object.fromEntries(
      [
        ...Object.values(document.scene.nodes),
        ...nodes
      ]
        .sort((left, right) => compareStableText(left.id, right.id))
        .map((node) => [node.id, node])
    )
  }
});

const collidesWithForeignNode = (
  document: ProjectDocument,
  nodes: readonly SceneNode[]
): string | null =>
  nodes.find((node) => {
    const current = document.scene.nodes[node.id];
    return current !== undefined && !isCompiledPartNode(current);
  })?.id ?? null;

const changedSets = (
  before: ProjectDocument,
  after: ProjectDocument,
  oldIds: readonly string[],
  newIds: readonly string[]
): {
  createdIds: readonly string[];
  changedIds: readonly string[];
  removedIds: readonly string[];
} => {
  const oldSet = new Set(oldIds);
  const nextSet = new Set(newIds);
  return {
    createdIds: newIds.filter((id) => !oldSet.has(id)),
    changedIds: newIds.filter(
      (id) =>
        oldSet.has(id) &&
        JSON.stringify(before.scene.nodes[id]) !==
          JSON.stringify(after.scene.nodes[id])
    ),
    removedIds: oldIds.filter((id) => !nextSet.has(id))
  };
};

export const compilePartScene = (
  document: ProjectDocument,
  input: CompilePartSceneInput
): CompilePartSceneResult => {
  const existing = readCompiledParts(document);
  if (!existing.ok) {
    return failure(
      'invalid_existing_model',
      existing.issues[0]?.path ?? 'scene.parts',
      'Existing compiled model violates part invariants.',
      existing.issues,
      'document'
    );
  }
  const replacedPartIds = new Set(
    input.parts.map((part) => part.partId)
  );
  const colors = materialColors(
    existing.parts,
    input.materials,
    replacedPartIds
  );
  if (!colors.ok) return colors;
  const retainedParts = new Map(
    [...existing.parts].filter(
      ([partId]) => !replacedPartIds.has(partId)
    )
  );
  if (retainedParts.size > 0) {
    return failure(
      'geometry',
      'parts',
      'Part compilation requires the complete canonical part recipe.'
    );
  }
  const canonicalized = canonicalizePartOccupancies(
    input.parts,
    document.settings.surfacePixelDensity
  );
  if (!canonicalized.ok) {
    return failure(
      'geometry',
      canonicalized.path,
      canonicalized.message
    );
  }
  const stripped = withoutReplacedParts(document, replacedPartIds);
  let working = stripped.document;
  const compiledNodes: SceneNode[] = [];
  try {
    for (const entry of canonicalized.parts) {
      const part = entry.spec;
      const baseColor = colors.colors.get(part.materialId);
      if (!baseColor) {
        return failure(
          'missing_material',
          `parts.${part.partId}.materialId`,
          `Material "${part.materialId}" has no base color.`
        );
      }
      const bone = boneForPart(
        part,
        document.settings.surfacePixelDensity,
        entry.canonicalAttachmentAnchor
      );
      const cubes = entry.cuboids.map((cuboid) =>
        cubeForCuboid(
          document,
          part,
          cuboid,
          baseColor,
          input.textureId
        )
      );
      const collision = collidesWithForeignNode(
        working,
        [bone, ...cubes]
      );
      if (collision) {
        return failure(
          'id_collision',
          `scene.nodes.${collision}`,
          `Stable generated node ID "${collision}" is already in use.`
        );
      }
      compiledNodes.push(bone, ...cubes);
    }
  } catch (error) {
    return failure(
      'geometry',
      'parts',
      error instanceof Error
        ? error.message
        : 'Part compilation failed.'
    );
  }

  working = addNodes(working, compiledNodes);
  const validated = readCompiledParts(working);
  if (!validated.ok) {
    return failure(
      'geometry',
      validated.issues[0]?.path ?? 'scene.parts',
      validated.issues[0]?.message ??
        'Compiled model violates part invariants.',
      validated.issues,
      'document'
    );
  }
  const nextIds = compiledNodes
    .map((node) => node.id)
    .sort(compareStableText);
  const changes = changedSets(
    document,
    working,
    stripped.removedIds,
    nextIds
  );
  const changed =
    changes.createdIds.length > 0 ||
    changes.changedIds.length > 0 ||
    changes.removedIds.length > 0;
  return {
    ok: true,
    document: changed ? working : document,
    projectedParts: input.parts.map((part) => {
      if (part.kind !== 'feature') return part;
      return canonicalized.features.find(
        (feature) => feature.partId === part.partId
      ) ?? part;
    }),
    ...changes
  };
};
