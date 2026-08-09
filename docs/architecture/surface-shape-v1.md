# Surface Shape V1

Surface Shape V1 is the coordinate-free planform authority for wings, fins,
sails, panels, and future supported surfaces. A human describes the desired
silhouette in chat. The Agent translates that request into Intent Program 1;
the compiler alone resolves lattice dimensions, convex pieces, hierarchy,
reflection, materials, and pixels.

The contract is part of the closed Intent Program 1 model block. A `surface`
declaration owns role and cardinality while its typed `parent`, `anchor`,
`growth`, and `lane` fields remain independent. An optional nested `shape`
declaration owns only the surface-local silhouette:

~~~text
surface pectorals paired fin parent torso anchor sides growth outward lane center
shape pectorals {
  axis longitudinal
  span long
  chord broad
  tip pointed
  offset posterior
  edge convex
}
~~~

Omitting `shape` selects the role's closed default planform. It does not insert
a hidden shape object into the Semantic AST. Supplying `shape` opts that surface
into the compiler-owned planform path.

## Closed semantic controls

| Control | Values | Meaning |
| --- | --- | --- |
| `axis` | `vertical`, `longitudinal`, `transverse` | Project-frame axis across the surface span. It may not be parallel to growth. |
| `span` | `short`, `medium`, `long` | Relative reach from the host. |
| `chord` | `narrow`, `medium`, `broad` | Relative width of the load-bearing surface. |
| `tip` | `pointed`, `rounded`, `flat`, `flared`, `forked` | Distal silhouette and lobe topology. |
| `offset` | `center`, `anterior`, `posterior`, `dorsal`, `ventral`, `medial`, `distal` | Morphological displacement along the chosen axis. |
| `edge` | `straight`, `convex`, `concave` | Chord development between root and tip. |

Offset vocabulary is closed by axis: longitudinal surfaces use
`anterior|posterior`, vertical surfaces use `dorsal|ventral`, and transverse
surfaces use `medial|distal`; every axis also accepts `center`. The reader
reports incompatible axis/growth and axis/offset combinations at their exact
source tokens.

These controls deliberately exclude world coordinates, arbitrary vertices,
cube IDs, UVs, material IDs, and procedural-noise parameters. They are stable
intent, not a second geometry authoring API.

## Authority flow

~~~text
surface + optional typed shape source
  → closed Semantic AST and source spans
  → constraint resolution
  → canonical, order-independent Model IR
  → immutable planned surface
  → deterministic project-frame planform stations
  → convex root, spar, and membrane regions
  → authoring span and reflection validation
  → object-space appearance and raster receipt
~~~

The immutable compilation plan owns parent resolution, anchor and lane, semantic
shape, region topology, and reflection. Geometry emission consumes that plan;
it does not read the source surface list again or infer a second shape.

The canonical plate primitive remains bounded to convex triangles and
trapezoids. Rounded, concave, and forked silhouettes are therefore decomposed
into stable, non-overlapping convex membrane pieces. Those pieces remain one
semantic membrane region bounded by the same declared spars, so authoring
quality and appearance bindings continue to see one supported surface.

## Composition examples

~~~text
# Rear-swept shark dorsal fin
surface dorsal single fin parent torso anchor top growth up lane center
shape dorsal {
  axis longitudinal
  span long
  chord broad
  tip pointed
  offset posterior
  edge convex
}

# Horizontal paired pectoral fins
surface pectorals paired fin parent torso anchor sides growth outward lane center
shape pectorals {
  axis longitudinal
  span medium
  chord broad
  tip pointed
  offset posterior
  edge convex
}

# Centered vertical forked tail
surface tail single fin parent tail-base anchor rear growth rearward lane center
shape tail {
  axis vertical
  span short
  chord broad
  tip forked
  offset center
  edge concave
}

# Broad manta-like wings
surface wings paired wing parent torso anchor sides growth outward lane center
shape wings {
  axis longitudinal
  span long
  chord broad
  tip rounded
  offset posterior
  edge convex
}
~~~

Independent named surfaces may be composed on different parents and anchors.
Appearance remains semantic and targets the surface obligation rather than its
generated pieces:

~~~text
mark tail-rim target surface tail region full placement edge as rim tone darker scale fine density sparse contrast medium
~~~

Paired surfaces are lowered once and reflected through the compiler-owned pair
plane. Equivalent declaration order, project frame rotation, part ordering,
and atlas packing must not change their semantic plan or reflected result.

## Compatibility and bounds

- Intent Program and Surface Shape versions remain `1`; this repository
  hardcut removes the old flat relation vocabulary rather than keeping two
  source authorities.
- A program without `shape` uses one deterministic role default. It never
  exposes or persists generated planform coordinates.
- Shape vocabulary and dimensions are bounded, so planning can reject an
  unsupported combination before any primitive is emitted.
- The normal supported-surface count, port, part, occupancy, atlas, receipt,
  and atomic materialization limits continue to apply.
- Raw geometry edits remain forbidden. A visual correction revises the
  semantic surface or shape declaration and recompiles the whole candidate.
