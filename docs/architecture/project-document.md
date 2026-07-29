# Canonical Project Document

Status: **In progress**

## Purpose

`ProjectDocument` is the Ashfox workbench source of truth consumed by the engine, UI,
renderer, validation, and exporters.

The canonical types and invariant validator are implemented in
`packages/engine-core`. There is one current document contract.

The accepted expansion for PBR materials, mesh attributes,
skinning, morph targets, and semantic roles is defined
separately in [Canonical Asset IR](asset-ir.md). Those capabilities are not
implemented by the current contract. Importers and exporters receive them
through the canonical Asset IR.

## Design requirements

- JSON-serializable metadata and structure.
- Binary texture and render data stored by blob reference.
- Stable IDs on every independently addressable entity.
- Explicit schema and document revisions.
- Host-neutral IDs and blob references.
- Deterministic ordering where ordering affects rendering or export.
- Atomic schema updates across types, readers, writers, fixtures, and tests.

## Implemented top-level type

```ts
type EntityId = string;
type AssetId = string;
type ClipId = string;
type Revision = string;
type Vec2 = [number, number];
type Vec3 = [number, number, number];

interface ProjectDocument {
  schemaVersion: 1;
  id: string;
  name: string;
  revision: Revision;
  formatProfile: ProjectFormatProfile;
  settings: ProjectSettings;
  scene: SceneGraph;
  textures: Record<AssetId, TextureAsset>;
  animations: Record<ClipId, AnimationClip>;
  createdAt: string;
  updatedAt: string;
}
```

`schemaVersion` is an internal rejection sentinel for the one supported stored
shape. It does not identify a product line or authorize parallel readers,
writers, validators, or exporters. `revision` identifies an immutable project
state produced by a committed command.

## Format profiles

```ts
type ProjectFormatProfile =
  | { id: 'ashfox.generic'; version: '1' }
  | {
      id: 'minecraft.java_block';
      version: string;
      namespace: string;
      modelPath: string;
      modelKind: 'block' | 'item';
      parent?: string;
      ambientOcclusion?: boolean;
      guiLight?: 'front' | 'side';
    }
  | {
      id: 'minecraft.bedrock';
      version: string;
      animationFormatVersion: '1.8.0';
      namespace: string;
      modelPath: string;
      animationPath: string;
      geometryKind: 'entity' | 'block';
      geometryIdentifier: string;
      visibleBounds?: { width: number; height: number; offset: Vec3 };
    }
  | {
      id: 'minecraft.java.geckolib5';
      version: '5';
      minecraftVersion: string;
      geometryFormatVersion: string;
      animationFormatVersion: '1.8.0';
      namespace: string;
      assetKind: 'entity' | 'block' | 'item';
      modelPath: string;
      animationPath: string;
      geometryIdentifier: string;
      visibleBounds?: { width: number; height: number; offset: Vec3 };
    }
  | {
      id: 'gltf.2';
      version: '2.0';
      container: 'gltf' | 'glb';
      imageStorage: 'external' | 'embedded';
      modelPath: string;
      copyright?: string;
    };

interface ProjectSettings {
  textureResolution: { width: number; height: number };
  uvPixelsPerUnit?: number;
  coordinateSystem: {
    up: 'y';
    handedness: 'right';
    unit: 'pixel' | 'block' | 'meter';
    rotationUnit: 'degree';
    rotationOrder: 'xyz';
  };
}
```

A format profile provides constraints and an explicit export target. It does
not replace the canonical document with a format-specific object model. The
current contract implements `ashfox.generic`, `minecraft.java_block`,
`minecraft.bedrock`, `minecraft.java.geckolib5`, and `gltf.2`. A profile is
selectable only when its discriminated type, validator, fixtures, and exporter
are implemented.

For `gltf.2`, `imageStorage: 'external'` emits texture sidecars. `imageStorage: 'embedded'` requires `container: 'glb'` and declares a self-contained output contract in which resolved PNG/JPEG bytes are stored inside the GLB BIN chunk.

## Scene graph

```ts
interface SceneGraph {
  roots: EntityId[];
  nodes: Record<EntityId, SceneNode>;
}

type SceneNode = BoneNode | CubeNode | MeshNode | LocatorNode;

interface NodeBase {
  id: EntityId;
  kind: 'bone' | 'cube' | 'mesh' | 'locator';
  name: string;
  parentId: EntityId | null;
  transform: Transform;
  visible: boolean;
  tags?: string[];
}

interface Transform {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  pivot: Vec3;
}
```

Hierarchy is expressed only with `parentId` and `roots`. Names are not used as foreign keys.

### Bone

```ts
interface BoneNode extends NodeBase {
  kind: 'bone';
}
```

### Locator

```ts
interface LocatorNode extends NodeBase {
  kind: 'locator';
  ignoreInheritedScale?: boolean;
}
```

Locators are stable scene entities. Minecraft exporters compile a visible locator under its parent bone and animation effect tracks reference it by ID. Name conversion happens only after the target validator proves locator names are unique.

### Cube

```ts
type CubeFaceDirection = 'north' | 'south' | 'east' | 'west' | 'up' | 'down';

interface CubeNode extends NodeBase {
  kind: 'cube';
  bounds: {
    from: Vec3;
    to: Vec3;
  };
  inflate: number;
  mirror: boolean;
  boxUv: boolean;
  uvOffset?: Vec2;
  rescale?: boolean;
  shade?: boolean;
  lightEmission?: number;
  faces: Record<CubeFaceDirection, CubeFace>;
}

interface CubeFace {
  enabled: boolean;
  textureId: AssetId | null;
  uv?: [number, number, number, number];
  rotation?: 0 | 90 | 180 | 270;
  cullFace?: CubeFaceDirection;
  tintIndex?: number;
  materialInstance?: string;
}
```

### Mesh

```ts
interface MeshNode extends NodeBase {
  kind: 'mesh';
  vertices: Record<EntityId, MeshVertex>;
  faces: Record<EntityId, MeshFace>;
  uvPolicy?: {
    symmetryAxis?: 'none' | 'x' | 'y' | 'z';
    texelDensity?: number;
    padding?: number;
  };
}

interface MeshVertex {
  id: EntityId;
  position: Vec3;
}

interface MeshFace {
  id: EntityId;
  vertexIds: EntityId[];
  uv: Partial<Record<EntityId, Vec2>>;
  textureId: AssetId | null;
}
```

## Texture assets

```ts
interface BlobRef {
  bucket: string;
  key: string;
  contentType: string;
  byteLength?: number;
  contentHash: string;
}

interface TextureAsset {
  id: AssetId;
  name: string;
  width: number;
  height: number;
  source: BlobRef;
  visible: boolean;
  sampling: 'nearest' | 'linear';
  colorSpace: 'srgb' | 'linear';
  renderMode: 'default' | 'emissive' | 'additive' | 'layered';
  renderSides: 'auto' | 'front' | 'double';
  pbrChannel?: 'color' | 'normal' | 'height' | 'mer';
  minecraft?: {
    key: string;
    resource: { namespace: string; path: string };
    extension: 'png';
    particle?: boolean;
  };
  metadata?: Record<string, string | number | boolean>;
}
```

Texture pixel data is not embedded in `ProjectDocument`. A `.ashfox` file is
one ZIP container containing `manifest.json`, `project.json`, and every texture
under `assets/`. The manifest maps texture IDs to archive entries, while the
document keeps validated blob references. Loading verifies ZIP checksums,
SHA-256, byte lengths, paths, and the exact texture set before the project can
replace the active revision.

## Animation

```ts
interface AnimationClip {
  id: ClipId;
  name: string;
  durationSeconds: number;
  fps: number;
  loop: 'once' | 'loop' | 'hold_on_last_frame';
  startDelay?: MolangExpression;
  loopDelay?: MolangExpression;
  animationTimeUpdate?: MolangExpression;
  blendWeight?: AnimationScalar;
  overridePreviousAnimation?: boolean;
  channels: Record<EntityId, TransformChannel>;
  triggers: Record<EntityId, AnimationTriggerTrack>;
}

interface TransformChannel {
  id: EntityId;
  targetNodeId: EntityId;
  property: 'position' | 'rotation' | 'scale';
  rotationSpace?: 'bone' | 'entity';
  keys: TransformKeyframe[];
}

interface TransformKeyframe {
  id: EntityId;
  timeSeconds: number;
  value: AnimationVec3;
  preValue?: AnimationVec3;
  postValue?: AnimationVec3;
  interpolation: 'linear' | 'step' | 'catmullrom';
  easing?: {
    type: string;
    arguments?: AnimationScalar[];
  };
}

type AnimationScalar =
  | number
  | { kind: 'molang'; source: string };

type AnimationVec3 = [
  AnimationScalar,
  AnimationScalar,
  AnimationScalar
];

type AnimationTriggerTrack =
  | SoundTriggerTrack
  | ParticleTriggerTrack
  | TimelineTriggerTrack;
```

Animation channels and effect locators target node IDs. Sound and particle keys contain one or more structured effects, each with an identifier, optional locator ID, optional pre-effect Molang script, and optional actor binding. Timeline keys contain one or more expressions. Actor animation timing, blending, and override controls are typed explicitly rather than stored as arbitrary target JSON. Export adapters may translate IDs to names only after validating uniqueness.

Transform key values have one canonical meaning:

- position is an additive offset from the node rest translation, in project units;
- rotation is an additive XYZ degree rotation composed with the rest rotation;
- scale is a multiplicative factor applied to the rest scale.

Minecraft actor-animation values already use this relative form. glTF channels replace node TRS values, so the glTF compiler resolves the relative values into absolute translations, composed quaternions, and rest-scale products.

## Editor state is separate

The following state belongs to the browser session and is never persisted in `ProjectDocument`:

- selected entities or faces;
- active tool and gizmo mode;
- camera position and viewport layout;
- expanded scene tree rows;
- active animation time during inspection;
- open panels and local drafts;
- pending optimistic commands.

User preferences may be persisted separately from the project.

## Required invariants

1. Every root ID exists and has `parentId: null`.
2. Every non-null `parentId` refers to an existing bone.
3. The scene graph is acyclic.
4. Every mesh face references at least three existing vertices.
5. Every texture reference resolves to an existing texture asset.
6. Every animation channel targets an existing scene node.
7. Entity IDs are never reused within a project.
8. Every cube carries all six face records; an unused face is explicit with `enabled: false`.
9. Names may repeat only when the active format profile permits it.
10. Dimensions, transforms, UVs, times, and FPS values are finite.
11. Target resource names are relative, normalized, and collision-free.
12. A committed revision cannot be modified in place.

Target validators add stricter rules:

- Java block/item rejects meshes, locators, animations, unbaked transforms, unsupported rotations, out-of-range element coordinates, missing UVs, and missing or colliding PNG bindings.
- Bedrock and GeckoLib 5 reject freeform meshes, duplicate bone or locator names, unbaked Minecraft transforms, missing UV data, duplicate animation channels or normalized timestamps, and colliding PNG paths.
- glTF 2.0 accepts cube and freeform mesh geometry but rejects Molang, effect tracks, mixed interpolation, Catmull-Rom keys, and Minecraft-only key envelopes instead of silently dropping them.

## Implementation evidence

- Canonical types: `packages/engine-core/src/model.ts`
- Invariant codes and validator: `packages/engine-core/src/validation.ts`
- Schema and invariant tests: `packages/engine-core/tests/projectDocument.test.ts`, `packages/engine-core/tests/validation.test.ts`
- Blockbench face-preserving snapshot DTO: `packages/blockbench-contracts/src/types/project.ts`

## Import normalization

- Missing required IDs are generated during import.
- Bone and clip name references are resolved to IDs.
- `path` and `dataUri` values are ingested into the blob store.
- `uvPixelsPerBlock` maps to `uvPixelsPerUnit`.
- Cube `from`, `to`, `origin`, and rotation values map into bounds and transform
  fields.
- Animation channel names map to `targetNodeId`.
- Ambiguous values produce import findings.
