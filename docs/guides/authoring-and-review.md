# Create and Refine Assets

ashfox is designed around one short source of truth: the Intent Program. Write
what the asset is and how its important forms relate; the compiler determines
the geometry, texture layout, hierarchy, rig, and animation synthesized from
the declared idle mode.

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

## Read the Intent Program

Every program includes these declarations:

~~~text
asset "Moonlit Kirin"
track hero
domain organism
frame front north
symmetry bilateral
rest neutral feet on legs
body core torso
body mass head from torso extends forward
body limb legs pair from torso extends down
surface wings pair wing from torso extends up
face full on head
eyes pair gaze center
nose present
mouth neutral
motion idle breathe
style palette ocean
~~~

The program answers a small set of questions:

| Declaration | Meaning |
| --- | --- |
| track | Essential is intentionally compact; hero has a larger compiler-derived detail budget. |
| domain | Whether the asset is an organism or a constructed form. |
| frame front | The direction that face, feet, and directional details must follow. |
| symmetry | Whether bilateral reflection is required. |
| rest | Explicit neutral support: feet, base, or wheels on a named module, or airborne. |
| body | A named core, then named mass, chain, limb, wheel, or radial modules with an explicit host and direction. |
| surface | A required `pair` or `single` wing, fin, sail, or panel, its named host, and its direction. |
| face | `face none`, or `face full on <body-id>` with centered eyes plus nasal and oral presence. |
| focal | A named hero focal stage on a body module when the hero uses `face none`. |
| motion | One explicit `motion idle still|breathe|scan` declaration. |
| style palette | A semantic palette family. ashfox derives role colors and surface tone. |

`body core <id>` is the root. Every other body declaration uses
`from <host> extends forward|rearward|up|down|left|right`; limbs and wheels
use the source spelling `pair`. A `pair` surface may extend lateral, up,
forward, or rearward. A `single` surface must explicitly extend left, right,
up, forward, or rearward. Bilateral assets cannot hide one left- or
right-sided surface. Hero track declares exactly one focal stage: either a
full face or `focal <id> on <body-id>`. A full face reserves the canonical
front, so its supported surfaces use lateral, up, or rearward directions;
use a body chain for an anterior form.

## Confirm only the intended meaning

The workbench displays the whole proposal before compilation. Read every
declared forward direction, symmetry mode, named neutral support, face or
focal stage, surface direction, idle mode, and palette. Confirm only if that
description expresses the asset you want.

Confirmation compiles the program atomically. A valid result becomes the one
canonical asset. A failed result leaves the current canonical asset unchanged
and reports the source location that must be revised.

## Review the compiled asset

Review front, side, three-quarter, and top views when direction matters. Check
the result as a reader would:

- the silhouette and main masses read before decoration;
- bilateral forms match as a pair, without reversing their forward direction;
- eyes remain readable and centered on the intended facial plane;
- feet, toes, and claws face project-forward; only declared contact regions
  touch the ground in a standing rest;
- a wing, fin, sail, or panel sits on its intended host and has a readable
  direction;
- base colors produce a visible pixel shadow, midtone, and highlight field;
- the neutral rest is standing, base-supported, wheel-grounded, or airborne
  as declared;
- the declared idle mode starts and ends at the same neutral state.

Describe a failed relationship in ordinary language, revise the program, then
repeat confirmation and compilation. A revision replaces the canonical result
as one atomic operation.

## Review delivery separately

The canonical asset is independent of delivery. Open **Export** only after the
canonical result is ready. Pick an adapter there and resolve only the
adapter-specific finding it reports. Java block, GeckoLib 5, Bedrock, GLB, and
glTF may package the same canonical asset differently, but none of them changes
the Intent Program or its compiled result.

Next: [Export a finished asset](save-and-export.md).
