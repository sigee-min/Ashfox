# Canonical Asset IR

Status: **Accepted direction**

Implementation: **Planned**

## Required expansion

The current `ProjectDocument` is sufficient for:

- hierarchical bones and locators;
- explicit cubes and low-complexity meshes;
- texture assets and per-face UVs;
- rigid-part Bedrock and GeckoLib animation;
- current Java, Bedrock, GeckoLib 5, glTF, and GLB export paths.

The canonical contract must expand for the highest-quality general glTF path
because it does
not canonically represent:

- PBR materials as entities;
- vertex or corner normals and tangents;
- multiple UV and color sets;
- skeletal skin weights and inverse-bind semantics;
- morph targets and weight animation;
- explicit mesh primitives and material slots.

These properties must be added directly to the one Asset IR before they are exposed by an
importer, provider, editor, or exporter. They cannot be reconstructed
differently by each adapter.

## Design rules

1. The repository supports one current Asset IR contract.
2. Bedrock, GeckoLib, and Java profiles do not acquire unsupported features.
3. Rich features are explicit capabilities, never arbitrary target JSON.
4. Stable IDs remain available for bounded AI observation and local edits.
5. Large binary data remains behind immutable blob references where practical.
6. Renderer and exporter projections cannot become writable authorities.
7. An importer rejects or reports data it cannot preserve.
8. A schema change updates every reader, writer, validator, fixture, and test
   in the same change.

## Material assets

```ts
interface MaterialAsset {
  id: string;
  name: string;
  model: 'unlit' | 'metallic_roughness';
  baseColorFactor: readonly [number, number, number, number];
  baseColorTextureId?: string;
  metallicFactor?: number;
  roughnessFactor?: number;
  metallicRoughnessTextureId?: string;
  normalTexture?: {
    textureId: string;
    scale: number;
  };
  occlusionTexture?: {
    textureId: string;
    strength: number;
  };
  emissiveFactor?: readonly [number, number, number];
  emissiveTextureId?: string;
  alphaMode: 'opaque' | 'mask' | 'blend';
  alphaCutoff?: number;
  doubleSided: boolean;
}
```

Texture bytes remain `TextureAsset` blobs. A material describes how textures
and scalar factors combine. Minecraft compilers map supported material roles
explicitly or report a target conflict.

## Mesh topology and attributes

The canonical mesh retains stable vertex and face IDs while separating
topology from per-corner attributes.

```ts
interface MeshVertex {
  id: string;
  position: Vec3;
  normal?: Vec3;
  color0?: readonly [number, number, number, number];
  skin?: readonly VertexInfluence[];
}

interface MeshCorner {
  vertexId: string;
  normal?: Vec3;
  tangent?: readonly [number, number, number, number];
  texcoord0?: Vec2;
  texcoord1?: Vec2;
  color0?: readonly [number, number, number, number];
}

interface MeshFace {
  id: string;
  corners: readonly MeshCorner[];
  materialId: string | null;
}
```

Per-corner normals and UVs preserve hard edges and seams without duplicating
semantic vertex IDs. Export compilers triangulate faces deterministically and
deduplicate final GPU vertices only in the output projection.

Imported high-density geometry may use a normalized binary topology blob plus
an immutable stable-ID index. The binary representation is an optimization,
not a second editable mesh.

## Skinning

```ts
interface VertexInfluence {
  jointId: string;
  weight: number;
}

interface SkinBinding {
  id: string;
  name: string;
  meshNodeId: string;
  skeletonRootId: string;
  jointIds: readonly string[];
  inverseBindMode: 'derive_from_rest_pose' | 'explicit';
  inverseBindMatrices?: BlobRef;
  maximumInfluences: 4 | 8;
}
```

Rules:

- every joint is a canonical bone ID;
- weights are finite, non-negative, sorted, and normalized;
- every skinned vertex has at least one influence;
- explicit inverse-bind matrices must match the joint order;
- rest pose plus inverse binds must reproduce the undeformed mesh;
- target profiles may set stricter joint and influence limits.

Bedrock and GeckoLib do not use `SkinBinding`; their geometry remains rigidly
owned by bones.

## Morph targets

```ts
interface MorphTarget {
  id: string;
  name: string;
  meshNodeId: string;
  positionDeltas: BlobRef;
  normalDeltas?: BlobRef;
  tangentDeltas?: BlobRef;
  defaultWeight: number;
}
```

Animation gains a separate numeric morph-weight channel. Minecraft target
profiles reject morph targets unless a future explicit bake policy is selected.
Export never silently drops them.

## Semantic roles

Display names are not reliable AI or retargeting keys. Nodes may carry
target-neutral semantic roles:

```ts
interface SemanticRole {
  taxonomy: string;
  role: string;
  side?: 'center' | 'left' | 'right';
  ordinal?: number;
  confidence?: number;
}
```

Examples include `anatomy/head`, `anatomy/tail`, `limb/fore_left`,
`mechanism/hinge`, or `attachment/hand_right`. Roles support rig templates,
motion retargeting, and bounded agent observations. They do not replace stable
IDs.

## Single-contract updates

1. Extend the canonical types directly.
2. Update fixtures and stored examples in the same change.
3. Preserve current cube, texture, animation, and target profile semantics.
4. Move cube texture binding through generated unlit materials only when byte
   identity and target fixtures prove parity.
5. Add round-trip fixtures before enabling rich glTF import.
6. Add renderer support before exposing a new authoring command.
7. Add validation and exporter support in the same change as each capability.
8. Update reader, writer, validator, and type definitions atomically.

## Explicit exclusions

Asset IR never stores:

- provider latent tensors or diffusion state;
- Three.js objects, WebGL buffers, or shader instances;
- Blockbench objects or codec state;
- derived scores or AI evaluation history;
- browser file handles;
- generated target JSON as canonical state.
