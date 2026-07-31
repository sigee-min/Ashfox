# Constrained Modeling Kernel

This document defines the implemented modeling authority, algorithms,
invariants, and proof boundary for ashfox.

## Goal

An agent describes a small set of meaningful parts. ashfox deterministically
turns those parts into a textured, rigged cuboid scene that existing Bedrock,
GeckoLib 5, glTF, and GLB exporters can consume.

The design deliberately trades unrestricted geometry for predictable output:

- the agent owns parts, proportions, parent relationships, optional joint
  intent, material IDs, and base colors;
- the compiler owns attachments, occupancy, cuboid subdivision, pivots,
  stable node IDs, and structural projection;
- the generated-surface derivation owns UVs, raster pixels, and atlas
  resolution;
- `ProjectDocument.modeling` is the persisted semantic authority for
  compiler-owned parts and materials;
- `ProjectDocument.scene` stores the verified structural projection and the
  rederivable surface cache consumed by the viewport and exporters.

The recipe does not duplicate density or texture IDs. Those values keep their
existing project-level authorities. Generated nodes do not store a second
editable copy of the part definition.

This is an executable specification, not a claim of formal verification by a
proof assistant. Algebraic arguments establish the small kernel properties
below, while exhaustive and property-style tests exercise their executable
counterparts. Subject identity and visual quality remain rendered-review
decisions.

## Authority and dependency direction

```text
AgentCommandPort
      |
      v
agent-filtered command capability
      |
      v
canonical executeCommandBatch
      |
      +--> PartSpec validation
      +--> lattice occupancy compiler
      +--> cuboid scene materialization
      +--> generated texture derivation
      +--> project and target invariants
      |
      v
ProjectDocument.modeling + verified structure + derived surface
      |
      v
receipt + one atomic history transition
      |
      +--> viewport
      +--> .ashfox persistence
      +--> Bedrock / GeckoLib 5 / glTF / GLB
```

The command registry is singular. Each registration also declares whether an
agent may call it. The host supplies the trusted command source; a batch cannot
claim that it came from the Web UI or system.

Editor-only raw scene commands pass through the same reducer. They cannot
target compiler-owned nodes or insert raw geometry into a compiled hierarchy.
The engine package does not publicly export its raw `addSceneNode` and
`updateSceneNode` helpers.

The dependency direction is one-way:

```text
normalized recipe -> occupancy -> decomposition -> scene -> UV/raster -> export
```

No downstream representation may write back into the recipe. Structural
projection validation rejects drift instead of choosing between two
authorities. UV and raster caches are deterministically rederived from the
accepted structure rather than reverse-writing modeling intent.

## Public modeling contract

The mutation surface is:

- `model.parts.upsert`
- `model.parts.mirror`
- `model.parts.transform`
- `model.parts.material`
- `model.parts.delete`

The persisted normalized part has:

- stable `partId`;
- `parentPartId`, or `null` for the one root;
- stable `materialId`;
- `fixed`, `hinge`, or `ball` joint;
- an engine-derived child attachment with `parentAnchor` and `partAnchor`;
- one primitive.

The five primitives are:

1. `mass`: superellipsoid-like volume;
2. `segment`: tapered polyline sweep with at most eight points;
3. `plate`: extruded triangle, trapezoid, or rectangle;
4. `radial`: axis-aligned disk or ring;
5. `feature`: small face-oriented relief.

Subject categories are not part of the schema. The kernel constrains geometry;
it does not encode creature, vehicle, bird, or humanoid archetypes.

## Why the exact-edit recipe must persist

Let `N` normalize a valid part recipe and let `C_(d,e)` compile it at surface
density `d` in a fixed project environment `e` (texture authority, coordinate
system, and existing scene context). The observable generated projection is

```text
P_(d,e) = C_(d,e) ∘ N.
```

Reconstructing an exact editable recipe from generated cuboids would require a
left inverse `R` such that

```text
R(P_(d,e)(recipe)) = N(recipe)
```

for every valid recipe. Such an inverse cannot exist because `P_(d,e)` is not
injective even when `d` and `e` remain fixed.

### Profile counterexample

Choose density `d = 1` and a root `mass` with integer center `(0, 0, 0)`,
radii `(1, 1, 1)`, and otherwise identical IDs, material, joint, and
attachment fields. Consider three recipes that differ only in profile:
`soft`, `balanced`, and `hard`. Their exponents are respectively `2`, `4`,
and `8`.

The only candidate cell centers on each axis are `-1/2` and `1/2`. At every
one of the eight Cartesian products, the occupancy score is:

```text
soft:     3(1/2)^2 = 3/4
balanced: 3(1/2)^4 = 3/16
hard:     3(1/2)^8 = 3/256
```

Every score is at most `1`, so every profile occupies the same set of eight
cells:

```text
{-1, 0} × {-1, 0} × {-1, 0}.
```

Deterministic cuboid decomposition therefore emits the same cuboid with lattice
bounds

```text
[-1, -1, -1] -> [1, 1, 1]
```

and the same stable generated IDs for all three recipes. Yet their normalized
profiles remain different. Therefore:

```text
P_(1,e)(soft) = P_(1,e)(balanced) = P_(1,e)(hard)
```

while

```text
N(soft) != N(balanced) != N(hard).
```

Thus `P_(1,e)` is not injective, and exact profile intent cannot be recovered
from the compiled scene.

### Consequence

The compiled scene is a lossy projection, not a reversible serialization of
modeling intent. Exact edits after save and reopen therefore require the
normalized recipe to persist.

For compiler-owned parts, `ProjectDocument.modeling` is that single canonical
recipe. Generated bones and cubes are a deterministic materialized view.
Loading requires their structural projection to match; missing or drifted
geometry is rejected rather than inferred or silently regenerated. Generated
UV and raster caches may be rederived after that structural gate.
`readPartRecipe` returns that persisted recipe.
`inspect({ kind: "parts" })` exposes its exact, project-space authoring
projection with compiler-owned attachment coordinates removed, so the result
can be reapplied without moving the model.

## Integer lattice

Let the selected surface density be

```text
d ∈ {1, 2, 4}.
```

All PartSpec coordinates are safe integers in lattice space. The conversion to
model space is

```text
world(i, d) = i / d.
```

A model-space coordinate `x` is aligned exactly when

```text
|x d - round(x d)| ≤ ε
```

with the implementation epsilon used only when reading an existing floating
point document. Newly compiled coordinates use integer division directly.

An occupied cell at lattice point `(i, j, k)` denotes the half-open volume

```text
[i, i+1) × [j, j+1) × [k, k+1).
```

The model-space side length of that cell is exactly `1/d`. Geometry, UV
dimensions, generated pixel patterns, atlas gutters, and atlas growth therefore
share one density authority.

Because PartSpec values are lattice coordinates rather than model-space
coordinates, density is immutable while compiled parts exist. Changing it
requires deleting the compiled model first. This avoids a state in which the
same PartSpec would mean two different geometries within one model history.

### Grid-alignment theorem

For every compiled cuboid bound `b`, the compiler first creates an integer
lattice bound and emits `b/d`.

Therefore:

```text
(b/d) d = b ∈ Z.
```

Every emitted bound is aligned to `1/d`. No rounding assumption is required.

## Primitive occupancy

All primitive tests sample lattice-cell centers. Iteration order does not
affect set membership.

### Mass

For center `c`, positive radii `r`, and profile exponent

```text
p = 2 for soft
p = 4 for balanced
p = 8 for hard,
```

cell center `x` is occupied when

```text
Σ axis |(x_axis - c_axis) / r_axis|^p ≤ 1.
```

### Segment

For each adjacent pair of control points `a`, `b`, sample point `x` is
projected onto the closed segment:

```text
t = clamp(dot(x-a, b-a) / dot(b-a, b-a), 0, 1).
```

The nearest point and three radii are linearly interpolated at `t`. The same
profile test used by `mass` decides membership. Occupancy is the union of all
segment spans.

### Plate

The outline is restricted to:

- three strictly convex ordered points;
- four strictly convex ordered points with at least one parallel pair of
  opposite edges.

A 2D cell center is accepted by consistent half-plane signs, then extruded by
positive integer thickness on the selected normal axis.

### Radial

For plane-space cell-center distance `r²`, a cell is occupied when

```text
innerRadius² ≤ r² ≤ outerRadius².
```

The accepted cells are extruded by integer depth.

### Feature

A feature is converted to a positive-thickness rectangular plate oriented to
one of the six canonical faces. Density 2 or 4 permits half- or quarter-unit
focal details without adding a separate mesh authority.

## Attachment and rig

Root geometry is in asset lattice space. Child geometry is local and receives
the integer translation

```text
T = parentAnchor - partAnchor.
```

For every child, the compiler searches within two cells for the nearest valid
shared child-parent face, derives the canonical anchor, and uses that anchor
divided by `d` as the bone pivot. Validation requires:

- the child and parent occupied sets to share at least one complete cell face;
- the pivot lattice point to lie on the closure of both occupied sets;
- the part graph to have exactly one root and no missing parent or cycle.

Each part always has the stable bone ID:

```text
bone:<partId>
```

Keeping one bone per part makes incremental upsert stable and preserves
animation-channel targets when primitive subdivision changes.

The rig contract is deliberately small:

- the root is `fixed`, but may receive rotation, position, or scale channels
  for whole-asset motion;
- a fixed child accepts no transform channel;
- a hinge child accepts rotation only, with numeric zero on the two undeclared
  axes;
- a ball child accepts rotation only.

Rig and attachment validation runs against the final batch result. A batch can
therefore create a joint and its animation, or delete both, in either operation
order without exposing an invalid intermediate state.

## Tolerant seam ownership

PartSpec volumes may intersect at a join. The compiler rasterizes the complete
recipe, orders parts by hierarchy and stable part ID, then gives each lattice
cell to the first ordered part that contains it. Parents therefore retain their
joint sockets, and payload order cannot change the result.

For raw occupancy `R_i` in canonical order, emitted occupancy is

```text
C_i = R_i \ union(R_j for j < i).
```

The recipe is rejected when a part penetrates more than two surface cells into
earlier geometry, retains 20% or less of its authored cells, becomes
disconnected, loses anchor contact, or stops contributing to the orthographic
silhouette.

### Ownership theorem

Every raw cell has one earliest containing part. It follows directly that:

```text
C_i intersection C_j = empty for i != j
union(C_i) = union(R_i)
sum(|C_i|) = |union(R_i)|.
```

Canonical ownership therefore preserves the complete authored union while
removing duplicate volume. The total hierarchy and ID order makes ownership
deterministic and independent of payload order. The persisted recipe keeps the
authored intersection so later edits remain semantic; rendering, UV generation,
validation, and export consume only `C_i`.

## Cuboid decomposition

Exact minimum 3D rectangle partition is not claimed. The kernel evaluates six
deterministic greedy candidates, one for every axis order:

```text
XYZ, XZY, YXZ, YZX, ZXY, ZYX.
```

For one order:

1. sort occupied cells lexicographically by that order;
2. take the first remaining cell;
3. expand its cuboid positively along the three ordered axes while every cell
   in the new slab remains unclaimed and occupied and each rectangular face
   has uniform neighboring occupancy in the complete canonical model;
4. remove exactly those cuboid cells;
5. continue until no cell remains.

Candidates are compared by the tuple:

```text
(
  cuboidCount,
  internalSeamArea,
  aspectPenalty,
  lexicalBoundsSignature
).
```

The first three entries are numeric and minimized. The last entry is a total
lexical tie-break.

### Exact-coverage theorem

Maintain remaining occupied cells `R`.

- Initially `R = O`, the complete occupancy.
- A cuboid expands only when every cell in its added slab belongs to `R`.
- The compiler removes every emitted cuboid cell from `R`.

Thus every emitted cuboid is a subset of `O`, and no two emitted cuboids share
a cell. Each iteration removes at least its seed, so the finite process
terminates. It terminates only when `R` is empty.

Consequently:

```text
union(cuboid cells) = O
intersection(cuboid_i, cuboid_j) = empty for i ≠ j.
```

`assertExactDecomposition` independently checks both conclusions.

### Determinism theorem

Canonical occupancy is a pure function of the complete normalized recipe.
Each greedy candidate uses a total seed order, fixed positive expansions, and
the same canonical environment. The six-candidate set is fixed. The score
tuple ends in a total lexical order.

Therefore one normalized recipe and density select exactly one decomposition.

The regression suite checks every non-empty occupancy of a `2×2×2` lattice
(255 cases), plus structured primitives and deterministic larger samples.

## Generated surface authority

Compiled geometry uses one generated atlas. For pixel-unit projects,

```text
texelsPerModelUnit = surfacePixelDensity = d.
```

A lattice cell has model side `1/d`, so its projected edge contains

```text
(1/d) d = 1
```

texel. Density 1, 2, and 4 therefore produce model-space texel sides `1`,
`1/2`, and `1/4` without a separate UV-scale setting.

For every generated cube face, the surface authority:

1. reconstructs its integer lattice bounds;
2. disables the face when its uniformly adjacent boundary cells are occupied;
3. projects the two in-plane world-lattice coordinates into pattern space;
4. groups touching coplanar faces by material, direction, and plane;
5. derives directional tone and deterministic bounded variation from the
   shared surface coordinates;
6. packs the resulting rectangles with density-scaled gutters into the
   smallest fitting power-of-two atlas from 16 through 4096.

A cube face owns one rectangular UV. Surface-conforming decomposition splits
cuboids at every mixed-occlusion boundary, so every emitted rectangle is either
fully external or fully internal. The enabled unit-face set is exactly the
boundary of the canonical occupancy union, with no internal or duplicate face.

### Decomposition-independence theorem

Let a visible surface texel have projected lattice coordinate `(u, v)` and
connected-surface key

```text
k = (materialId, direction, plane, connectedComponentBounds).
```

Its generated color is a pure function

```text
color = F(baseColor, direction, u, v, connectedComponentBounds, hash(k)).
```

Cuboid bounds and atlas placement are absent from `F`. Splitting one coplanar
surface into different cuboids changes only which UV rectangle carries a
texel; its `k`, `(u, v)`, shared bounds, and color are unchanged. Semantic part
IDs are also absent from `k`. Therefore touching coplanar generated surfaces
with the same material do not restart their pattern at cuboid or part seams.

This theorem does not claim continuity across disconnected components,
different directions, or different materials. Those boundaries intentionally
receive independent tone or seed.

## Stable IDs

Cube identity uses the reversible tuple:

```text
(partId, density, minX, minY, minZ, maxX, maxY, maxZ).
```

It is serialized without a lossy hash. Two cubes in one part can have the same
ID only if every tuple component is equal, in which case they are the same
lattice cuboid. Unrelated existing IDs cause atomic rejection instead of
overwrite.

## Structural validation

Structured node provenance records:

- compiler authority;
- role (`bone` or `geometry`);
- part and parent IDs;
- material ID;
- primitive;
- joint.

It is not exported as glTF tag text. Validation reconstructs occupied cells
from canonical cube bounds and checks:

- stable bone and cube IDs;
- identity generated cube transforms and zero inflate;
- exact density alignment;
- one connected 6-neighbor component per part;
- one root and an acyclic parent graph;
- parent contact and joint pivot contact;
- one canonical owner for every emitted occupied cell;
- one base color per material ID;
- one visible contribution in at least one of the six orthographic
  projections;
- no foreign cube or bone below a compiled part bone;
- exact agreement between the persisted recipe and generated structural
  projection;
- joint-specific animation channels;
- document-level part and occupied-cell budgets.

Authored joins use the canonical ownership and retention policy. Duplicate
cells in the emitted scene are projection drift and remain an error. Overlap
with foreign transformed cubes has no semantic ownership relation, so it uses
strict world-space axis-aligned bounding boxes. That check is conservative:
passing proves separated bounds, while a rotated but visually separate foreign
cube can still be rejected when its bounding box intersects.

### What validation proves

If validation succeeds, the implemented predicates above hold for the
canonical scene under the engine's axis-aligned lattice model.

Validation does not prove:

- that the render depicts the requested subject;
- anatomical, historical, or mechanical fidelity;
- aesthetic quality;
- global minimum cuboid count.

Those claims require rendered comparison with the request and references. The
manifest keeps this semantic review explicit instead of converting cube counts
into a false quality metric.

## Atomicity theorem

`executeCommandBatch` never mutates the input document. It applies operations
to structured clones of the document and batch, compiles parts, derives
generated textures, and validates the final document. The public boundary
catches exceptions. Any invalid payload, stale revision, invariant failure, or
exception returns the original revision and no candidate document.

Only a successful result reaches `historyReducer`, which stamps one revision
and one receipt. A successful modeling batch creates one Undo snapshot;
`project.create` intentionally replaces the project and clears prior history.
Therefore a rejected part, texture, animation, or target state cannot partially
commit.

The Web adapter accepts only an operation list and derives the active project,
revision, and unique canonical batch identity at submission time. The fallback
transport binds completed results to its request ID, so an identical replay
returns the same result and conflicting reuse is rejected. Every terminal
result clears the working state. These transport properties do not create a
second mutation path: the adapter validates and forwards to the same command
reducer.

## Complexity and budgets

Let `N` be occupied cells and `C` emitted cuboids.

- connectivity is `O(N)` time and space;
- seam ownership and trim-depth traversal are `O(N)` time and space;
- six-view silhouette evaluation is `O(N)` time;
- exact decomposition verification is `O(N)` time and space;
- surface-conforming greedy decomposition evaluates six fixed candidates. Its
  conservative worst case depends on repeated slab and boundary-face checks,
  while command budgets bound practical work.

The contract limits one upsert operation to 64 parts, eight points per
segment, 131,072 estimated cells per part, and 524,288 estimated cells per
upsert. A batch accepts at most one part upsert. The canonical document is
independently limited to 1,024 parts and
2,097,152 occupied cells, so a multi-operation command batch cannot evade the
document budget. These are performance bounds, not quality scores.

## Extension rule

A new primitive is acceptable only when it:

1. normalizes to bounded integer input;
2. produces one deterministic occupancy set;
3. passes canonical seam ownership, connectivity, attachment, silhouette, and
   surface-conforming decomposition invariants;
4. requires no new persisted geometry authority;
5. requires no target-specific exporter branch.

This keeps future shape vocabulary behind the same compiler and preserves one
canonical modeling recipe, one verified structural projection, and one
surface, reducer, and export authority.

A new renderer or exporter consumes the verified scene and texture projection;
it does not gain a modeling mutation path. A new agent transport consumes the
same inspect and command contracts; it does not gain reducer logic. These two
rules keep extensibility at the boundaries without reopening authority.
