# Authoring and review

Start with an asset-codebase plan, not a single large file. Decide which rigs,
motions, surfaces, and components should remain nominally reusable, then keep
each entry as explicit assembly.

## Choose source owners

| Declaration | Sole authority |
| --- | --- |
| `rig contract` | semantic joint tree, signed frames, channels, mirrors, sockets |
| `skeleton` | complete concrete rest implementation of one rig |
| `surface contract` | exact atlas/chart/material/slot ABI |
| `surface` | concrete deterministic palette, chart paint, grain, stamps, and material |
| `component` | reusable lexical geometry plus typed rig/surface/socket ports |
| `motion` | rest-relative rotation/scale tracks for one nominal rig |
| `asset` | skeleton choice, component instances, bindings, connections, motions, settings |

An import is always an explicit quoted path plus alias. A reference is local or
`alias.Name`. Matching names or similar shapes do not create compatibility.

## Geometry before paint

- Use cubes for positive-volume masses, attachment, depth, and silhouette.
- Use a plane only for an intentionally zero-thickness feature whose edge-on
  disappearance is acceptable.
- Put hierarchy in lexical `bone` blocks. Bind component bones to semantic rig
  joints or exact socket frames; do not infer a nearby parent.
- State every origin, size, basis, frame, and surface chart binding.
- Keep geometry private to its component unless callers need a typed parameter
  or port. Do not expose arbitrary emitted nodes as an override surface.

## Deterministic surfaces

Define exact chart dimensions in the surface contract. A concrete surface owns
the texture atlas, palette roles, chart origins/fills, optional stamps and
blotch patterns, one seed-only clustered-grain pass, and optional voxel tone.

Texture variation is source-deterministic. The seed changes the exact bounded
microvariation; it is not runtime randomness. Texture cannot repair a missing
mass, weak silhouette, bad joint, or floating attachment. Conversely, geometry
must not duplicate a paint mark as a coplanar surface.

## Reuse without inheritance

Components use closed typed parameters and nominal ports. Calls bind every
parameter and port once by name. Socket contracts make an attachment ABI
explicit, including handedness, frame, and capacity. Motion targets semantic
rig joints, so the same motion can be applied to any skeleton implementing the
same nominal rig with compatible signed frames.

There are no classes, inheritance, mixins, structural subtyping, default
arguments, wildcard imports, runtime packages, or automatic retargeting. If
two concepts differ in contract, model that difference explicitly rather than
adding an override chain.

## Review order

1. Inspect the smallest gameplay view for silhouette and facing.
2. Check front, side, top, and perspective for hierarchy, contact, clipping,
   negative space, and connected volume.
3. Check native texels, palette grouping, chart boundaries, alpha, and focal
   stamps.
4. Scrub every motion and inspect pivots, signed-frame mapping, loops, and
   target-export findings.
5. Use Build replay to confirm deterministic element and texture application.

Compiler success proves language, closure, and canonical invariants. It cannot
certify taste. A review issue belongs to the owning module and is resolved by
one new atomic workspace change.

For the exact declaration grammar, see
[Asset language](../architecture/asset-language.md).
