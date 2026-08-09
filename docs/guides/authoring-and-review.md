# Create and Refine Assets

A strong first request establishes the whole asset. Short follow-up requests
then fix one visible issue at a time.

## Start with the complete result

Describe:

- **subject** — creature, vehicle, prop, block, or environment piece;
- **style** — Minecraft-like pixels, chunky low-poly, mechanical, organic, or
  another clear direction;
- **structure** — important parts, proportions, symmetry, and articulation;
- **forward** — the exact direction the face, feet, toes, wheels, or tracks
  travel toward;
- **surface** — base-color palette, material separation, and focal details;
- **motion** — required clips, pace, weight, and loop
  behavior.

```text
Create a moonlit fantasy kirin.
Keep the silhouette readable at Minecraft scale, place the eyes clearly for
front and three-quarter views, use a restrained blue-gold pixel palette,
and add calm idle and alert animation clips.
```

Avoid starting with a long list of individual cubes. The agent can establish a
better hierarchy when it understands the final silhouette and motion first.

## Confirm semantic intent before modeling

The agent first submits a non-authoritative intent proposal. It must explicitly
classify the subject as an organism or constructed form, declare canonical
support, declare whether a full face with single or paired eyes is required,
seal nasal and oral structure independently as present or absent, and list
every single or paired wing, fin, sail, or panel obligation with an explicit
lateral, up, forward, or rearward extension. Free placement requires cited
reference evidence; it is not a skip-validation flag.

Review every displayed forward/grounding frame, symmetry plane, feature,
reference, free-placement evidence ID, face-presence state, and surface
direction in the workbench. Confirm only when the complete proposal is correct.
Until confirmation, authoring configuration, model work, and delivery
remain paused. Confirmation seals the one intent authority consumed by the
profile. Once parts exist, neither sealed intent nor its exact semantic profile
can be replaced; remove all canonical parts before intentionally starting a new
authority.

## Select the representation track and structure

For a new agent-authored asset, ashfox composes one subject-neutral module graph
from request and reference provenance before modeling. The graph explicitly
declares core masses, directed axes, articulated chains, spans, focal frames,
and silhouette accents together with their parent, symmetry, direction, and
typed base/foot support relations. Focused specialists may add surface, silhouette, grounding, or
motion policy, but never manufacture body topology.

Motion authority belongs to the canonical authoring profile, not to an export
target. Export adapters may omit unsupported motion from one artifact, but they
never delete or rewrite canonical clips.

Every structural slot also declares `span`. Non-span slots use `kind: none`.
A supported surface partitions the slot into segment roots, named segment
spars, and plate membranes bounded by two named spars. It also carries the
sealed surface `obligationId`; no part ID may be
unclassified or shared. For paired surfaces, matching semantic IDs must be
exact reflected counterparts rather than merely producing a symmetric union.
The obligation separately seals `lateral | up | forward | rearward` extension,
which the compiled span must realize without role-based inference.

A full semantic face seals eye configuration and the presence or audited
absence of nasal and oral structure. `present` requires exactly one distinct
component with no exception. `absent` requires no component and exactly one
current, evidence-backed exception; a muzzle or mouth cannot be relabeled as
the generic face host.

The asset also declares one whole-asset representation track:

- `essential` deliberately distills an icon, mascot, chibi subject, or small
  game piece while retaining a decisive silhouette, connected middle form,
  contacts, semantic regions, and every declared identity cue;
- `hero` preserves reference proportions, secondary mass rhythm,
  articulation, roots, terminal forms, openings, focal modules, and material
  boundaries. It is the default for ambiguity and high-fidelity work.

Ask the agent to report the track, structural modules, specialists, evidence
claims, and explicit feature coverage before modeling. A full face adds a
conditional facial-read contract, but it never substitutes for whole-asset
structure or quality.

The configured part recipe is authored in one canonical neutral rest pose.
When neither the request nor a reference explicitly calls for floating or free
placement, choose grounded intent. For an otherwise unspecified ground-capable
organism, propose `standing-feet`; for a constructed form, propose
`supported-base`. Explicit legs or feet still justify `standing-feet` in either
domain. `free` is reserved for user- or reference-directed free placement,
never a shortcut around stance validation. Sitting and crouching are animation
poses, not static recipe rests.

Every optional slot must justify its geometry through silhouette, articulation,
recognition, or target-format correctness. Color-only belts, panels, fur patches,
runes, and face marks belong in semantic surface features.

## Correct one visible problem

Name what you see and what the result should become.

```text
The eyes disappear at three-quarter view.
Move them slightly higher and outward while preserving a forward gaze.
```

```text
The rear wheels feel too small beside the cab.
Increase only their diameter and keep the axle and fenders aligned.
```

Do not repeat the complete project description. Your agent can inspect the
current ashfox project before changing it.

## Ask for an exact outcome when precision matters

Describe the relationship that must hold instead of prescribing raw cubes,
bones, or UV coordinates:

- “Make the right horn match the left horn in silhouette and placement.”
- “Move each wheel attachment to the center of its axle.”
- “Preserve the body proportions while widening only the rear track.”
- “Stagger the four leg cycles evenly.”
- “Keep every ordinary toe north of its foot; only the authored dewclaw may
  point backward.”
- “Close the idle loop without changing its duration.”

ashfox applies related edits together, so Activity and Undo represent the whole
correction rather than dozens of disconnected field changes. The canonical
semantic part graph remains the modeled asset authority; generated cubes and UV
coordinates are derived output. Catalog recipes are discovery examples only.

## Review the model

Ask the agent for required-slot and specialist preview milestones before final
review. Then render front, side, and three-quarter views in Studio lighting,
and check Day, Evening, and Night when lighting readability matters.
Have it verify that large forms read before decoration, focal details remain
visible, and moving parts have useful pivots without resting intersections.
For directional creatures, also render the top view. Trace shoulder or hip,
knee or elbow, ankle or wrist, foot, and toe in order. The foot and ordinary
toes must continue toward the declared forward direction in both side and top
views; mirroring left to right must never reverse the forward axis.
The compiler checks these relations again from final occupied cells. Grounded
soles must touch `y=0` without crossing it; only declared sole, toe, and claw
contact surfaces may own ground cells, never the foot root. The standing core
and center of mass must remain above the declared contact hull. Lifted or rear
feet still keep their toes and claws pointed along the same project forward.

## Review textures and UVs

- Use the fixed iconic form scale. Do not increase geometric density to create
  smaller decorative details.
- Check that material regions use deliberate, reusable base colors.
- Make sure each visible face belongs to the generated atlas.
- Look for stretched pixels, seams, empty faces, and mismatched material color.
- Confirm that one square pixel has exactly the same size on every face.
- Keep important accents visible at the distance where the asset will be used.
- Use zero-depth semantic features for focal face marks and color-only regions.
  The agent chooses the host face, placement, extent, motif, and material role;
  Ashfox chooses the deterministic role pixels, UV projection, and atlas
  result. Keep these features on exposed volumetric surfaces and do not replace
  them with sockets, pupils, highlights, masks, billboards, or overlay cubes.
  Eyes use a 3x3-or-larger square/slit footprint. Ashfox derives a contrasting
  sclera, iris, pupil, and outline; paired even-width pupils choose their inner
  center pixel so the gaze converges instead of drifting outward.
  Review the compiled rest pose to ensure each focal glyph remains visible and
  contrasts with its host.
- Let ashfox derive the tonal pixel surface pattern from each base color.
  The base color is the material anchor; ashfox derives visibly separated
  shadow, midtone, and highlight roles, including for very dark or very light
  colors. Large faces distribute all three roles instead of leaving a broad
  exact-base plateau. Focal surfaces retain the macro shade field while
  suppressing only distracting high-frequency variation.
  Coplanar generated surfaces share world-lattice pattern coordinates, so a
  cuboid split does not restart the pattern.

## Review animation

Ask the agent to play each clip once at normal speed and inspect its strongest
pose and loop boundary. Have it check feet, wheels, wings, tails, and attached
parts for sliding or clipping. Request a correction only when the visible
problem can be named.

Stop refining when the silhouette, focal details, surface treatment, and motion
are readable, the final frame receipt acknowledges every returned authority
review check, and export validation has no blocking issue.

Next: [Export a finished asset](save-and-export.md).
