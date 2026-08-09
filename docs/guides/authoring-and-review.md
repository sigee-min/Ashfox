# Create and Refine Assets

ashfox is designed around one short source of truth: the Intent Program. Write
what the asset is and how its important forms relate; the compiler determines
the geometry, texture layout, hierarchy, rig, and canonical idle.

## Start with the intended result

Describe the subject, its decisive silhouette, its forward direction, its
neutral support, its face, and any surface that must be structurally present.
State relationships instead of construction instructions.

~~~text
Create a moonlit kirin with a readable horned silhouette, paired upward wings,
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
rest neutral feet
body core torso
body limb legs pair from torso
surface wings pair wing from torso extends up
face full
eyes pair gaze center
nose present
mouth neutral
style palette ocean
~~~

The program answers a small set of questions:

| Declaration | Meaning |
| --- | --- |
| track | Essential is intentionally compact; hero has a larger compiler-derived detail budget. |
| domain | Whether the asset is an organism or a constructed form. |
| frame front | The direction that face, feet, and directional details must follow. |
| symmetry | Whether bilateral reflection is required. |
| rest | Neutral standing feet, a supported base, or airborne placement. |
| body | Named core, mass, chain, limb, wheel, or radial relationships. |
| surface | A required single or paired wing, fin, sail, or panel and its direction. |
| face | Whether a full face exists; a full face declares centered single or paired eyes plus nasal and oral presence. |
| style palette | A semantic palette family. ashfox derives role colors and surface tone. |

A surface uses one of four directions: lateral, up, forward, or rearward. A
bilateral lateral surface must be paired. A neutral feet rest is bilateral, so
every standing limb is compiled as a matched pair.

## Confirm only the intended meaning

The workbench displays the whole proposal before compilation. Read every
declared forward direction, symmetry mode, neutral support, face state, surface
direction, and palette. Confirm only if that description expresses the asset
you want.

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
- the neutral rest is standing, base-supported, or airborne as declared;
- the canonical idle starts and ends at the same neutral state.

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
