# Create and Refine Assets

ashfox is designed around one short source of truth: the Intent Program. You
describe what the asset should be in ordinary language in your agent's external
chat; the agent authors and diagnoses Intent Program 1, decides when it is
ready, and compiles it. The compiler determines geometry, texture layout,
hierarchy, rig, and animation.
The Web Studio is an observation and delivery surface, not a source editor.

## Start with the intended result

Describe the subject, its decisive silhouette, its forward direction, its
neutral support, its face, and any surface that must be structurally present.
State relationships instead of construction instructions.

~~~text
Create a moonlit kirin with a readable horned silhouette, mirrored upward wings,
grounded feet, clear centered eyes, and a restrained blue-gold palette.
~~~

Good follow-ups are equally semantic:

- “Keep the face centered but make the horns taller.”
- “Make the two fins mirror each other and extend upward.”
- “Keep all feet pointed forward in the neutral stance.”
- “Use a darker, metallic palette without changing the form.”

Avoid coordinates, cube counts, transform values, pivots, material IDs, UVs,
and keyframes. Those are compiler output, not a second editing language.

## Understand the Agent-authored program

You do not need to read or write Intent Program source to use ashfox. The agent
translates your prompt into a complete technical program whose declarations
look like this:

~~~text
metadata {
  name "Moonlit Kirin"
  track hero
  domain organism
}

model {
  orientation forward north
  symmetry bilateral
  support feet contacts legs
  body {
    core torso
    mass head single parent torso anchor front growth forward lane center
    limb legs paired parent torso anchor sides growth down lane center
  }
  surface wings paired wing parent torso anchor sides growth up lane center
  shape wings {
    axis longitudinal
    span long
    chord broad
    tip rounded
    offset posterior
    edge convex
  }
  face {
    full parent head
    eyes paired gaze center
    nose present
    mouth neutral
  }
}

animation {
  idle breathe target torso
}

appearance {
  palette ocean
  texture mottle scale broad density balanced contrast subtle
  seed moonlit-kirin
  mark pale-belly target body torso region ventral placement whole as wash tone lighter scale broad density sparse contrast subtle
  mark wing-tips target surface wings region full placement tip as patch tone accent scale medium density sparse contrast medium
}
~~~

The program answers a small set of questions:

| Owner | Meaning |
| --- | --- |
| metadata | Closed whole-asset classification: name, Essential or Hero track, and organism or constructed domain. It is not an arbitrary key/value bag. |
| model | Orientation, symmetry, support contacts, body graph, supported surfaces and shapes, face, and optional hero focal stage. |
| animation | One explicit `idle still|breathe|scan`, optionally targeted with `target <body-id>`. |
| appearance | Palette, deterministic material texture, seed, and semantic local marks. The agent targets named meaning—never UV coordinates. |

`core <id>` inside the model's `body` block is the root. Every other body declaration uses
`parent <id> anchor <port> growth <axis> lane <sub-port>`; limbs and wheels
use the explicit cardinality `paired`. Parent is topology only, while anchor, growth,
and lane are independently validated spatial and morphology inputs. Feet and
wheel supports may name
multiple compatible paired modules; every named pair owns real grounded
support. A `paired` surface uses a `sides` anchor and an explicit growth axis.
A single surface must explicitly name its anchor and growth. Bilateral assets
cannot hide one left- or
right-sided surface. Hero track declares exactly one focal stage: either a
full face block or `focal <id> parent <body-id>`. A full face reserves only the
`front`/`center` presentation slot; other valid lanes on the front anchor
remain available. Use a body chain when another form needs that reserved slot.

An optional `shape <surface-id> { ... }` declaration lets the agent design the
surface without exposing vertices or cubes. It selects `axis
vertical|longitudinal|transverse`, `span short|medium|long`, `chord
narrow|medium|broad`, `tip pointed|rounded|flat|flared|forked`, a compatible
semantic `offset`, and `edge straight|convex|concave`. Every shape field is
required exactly once and is checked by the surface-shape schema. This covers forms such
as rear-swept dorsal fins, horizontal pectoral fins, broad wings, and forked
vertical tails. Omitting it selects the role's canonical default geometry.

`symmetry asymmetric` does not outlaw paired wheels, limbs, surfaces, or eyes.
It keeps the root and unpaired modules asymmetric while the compiler assigns
one local pair plane to explicitly paired topology and validates only those
pairs as exact reflections.

## Observe the autonomous build

The agent lints the complete program, stages it, inspects the evidence bound to
that staged revision, and decides whether to revise or compile. While that
happens, the viewport may automatically show an ephemeral AI preview. It is
temporary visual feedback only: it cannot be edited, selected as an authority,
or persisted as a second asset.

Compilation remains atomic. A valid result becomes the one canonical asset;
an invalid or stale result leaves the previous canonical asset intact while
the agent diagnoses and replaces the staged program. Compilation provenance
remains machine-level evidence rather than a workbench control.

The compact status rail reports **Ready for your prompt**, AI preparation or
revision, AI visual review, and **Ready to export**. Its separate **Autosaved**
state describes browser-local source persistence. A downloaded `.ashfox` is
the same source authority, not a compiled project archive.
You can change the camera or environment and play compiled motion at any point
without changing the asset.

## Observe the compiled asset

The agent owns the required visual review. You can still inspect front, side,
three-quarter, and top views when direction matters and describe anything that
does not read correctly:

- the silhouette and main masses read before decoration;
- bilateral forms match as a pair, without reversing their forward direction;
- eyes remain readable and centered on the intended facial plane;
- feet, toes, and claws face project-forward; only declared contact regions
  touch the ground under standing support;
- a wing, fin, sail, or panel sits on its intended host and has a readable
  direction;
- base colors produce a visible pixel shadow, midtone, and highlight field;
- support is standing, base-supported, wheel-grounded, or explicitly `none`
  as declared;
- the declared idle mode starts and ends at the same neutral state.

Describe a failed relationship in ordinary language. The agent revises the
program, evaluates it, and recompiles when it is ready. A successful revision
replaces the canonical result as one atomic operation.

## Review delivery separately

The canonical asset is independent of delivery. Open **Export delivery files** only after the
canonical result is ready. Pick an adapter there and resolve only the
adapter-specific finding it reports. Java block, GeckoLib 5, Bedrock, GLB, and
glTF may package the same canonical asset differently, but none of them changes
the Intent Program or its compiled result.

The Web Studio canonical project is not implicitly synchronized with the
optional Blockbench compatibility product. A Blockbench project session has
its own host and revision authority; transfer between products is always an
explicit file or adapter action.

Next: [Export a finished asset](save-and-export.md).
