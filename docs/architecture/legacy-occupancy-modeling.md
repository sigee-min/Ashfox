# Legacy Occupancy Modeling Kernel

Status: historical and superseded

Superseded by
[Iconic Hardcut Modeling](iconic-hardcut-modeling.md).

This document records the modeling system Ashfox used before the iconic
hardcut. It is not a contract for new authoring.

## What the legacy kernel did

The public authoring unit was a semantic part rather than a raw cube. A recipe
contained `mass`, `segment`, `plate`, `radial`, and zero-depth `feature` parts.
The compiler materialized those parts through this pipeline:

```text
semantic recipe
  -> primitive rasterization
  -> lattice occupancy
  -> overlap trimming and seam ownership
  -> surface-conforming cuboid decomposition
  -> bones and generated cubes
  -> generated UVs, raster, and atlas
```

### Primitive rasterization

Every volumetric primitive first became a set of occupied lattice cells.

- A mass sampled a block or superellipsoid profile.
- A segment sampled an interpolated superellipsoid along its control path.
- A plate rasterized a convex face and extruded it by integer thickness.
- A radial rasterized a disk or ring and extruded it along one axis.
- A feature owned no volume and projected a marking onto its parent's surface.

Surface density could be 1x, 2x, or 4x. Higher density increased both geometric
sampling and texture resolution.

### Canonical occupancy

Parts were processed in deterministic hierarchy and ID order. Earlier geometry
owned overlapping cells; later parts lost those cells at their seams. The
compiler rejected disconnected remnants, excessive penetration, missing parent
contact, and geometry with no orthographic silhouette contribution.

This produced an exact, non-overlapping occupancy authority and deterministic
attachment anchors and pivots.

### Cuboid decomposition

The compiler tried six XYZ axis orders and greedily expanded each remaining
cell into a cuboid. Candidates were ranked by:

1. cuboid count;
2. internal seam area;
3. aspect penalty;
4. stable lexical bounds.

Expansion stopped whenever a cuboid face would have mixed neighboring
occupancy. This surface-conforming rule was necessary because a generated cube
face could only be enabled or disabled as one rectangular unit.

The resulting cuboids covered the canonical occupancy exactly, did not overlap,
and retained stable generated IDs.

### Generated surfaces

The surface generator determined external faces, assigned UV rectangles, and
sampled deterministic pattern coordinates across coplanar generated cuboids.
Base colors became directional tonal clusters and automatic pixel noise. This
part of the system was successful and is retained by the hardcut architecture.

## What the legacy kernel got right

- Semantic recipes remained the editable authority.
- Generated bones, cubes, UVs, and raster pixels were reproducible.
- Exact occupancy and stable IDs made export validation reliable.
- Surface-conforming decomposition prevented partial internal faces and
  z-fighting.
- Connected surfaces shared deterministic texture coordinates across cuboid
  seams.
- Commands, compilation, texture derivation, and validation committed as one
  atomic revision.

Determinism, single ownership, surface continuity, and export correctness
remain requirements. Exact surface-conforming decomposition does not: the
hardcut permits rectangular face overdraw only where it remains hidden inside
already occupied model volume.

## Why it was superseded

The failure was the direction of form generation. The kernel first created
fine cells and only afterward tried to compress them. It therefore preserved
sampling detail that should never have existed.

Typical failure modes were:

- rounded profiles producing stair-stepped anatomy and many small cuboids;
- higher density disguising uncertain design as geometric detail;
- bevels, sockets, scales, and ribs competing with the main silhouette;
- cube-count controls treating a compiler symptom as an artistic rule;
- anatomical eye heuristics encouraging extra support geometry;
- agents attempting per-pixel decisions they could not keep coherent;
- generated cube internals becoming visible as if they were authoring units.

The system could be structurally exact while still producing an uncanny,
over-described model.

## What remains from the legacy system

The hardcut retains:

- the external semantic command and document boundary;
- atomic reducers, history, validation, and export adapters;
- semantic bones, provenance, stable ordering, and deterministic IDs;
- automatic UV, palette-cluster, directional-tone, and noise generation;
- the project/archive container boundary for current hardcut documents;
- derived occupancy where it is useful for contact, collision, and surface
  validation.

The hardcut does not retain occupancy rasterization as the primary form
generator or cuboid compression as the source of visual style.
