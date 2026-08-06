# Create and Refine Assets

A strong first request establishes the whole asset. Short follow-up requests
then fix one visible issue at a time.

## Start with the complete result

Describe:

- **subject** — creature, vehicle, prop, block, or environment piece;
- **style** — Minecraft-like pixels, chunky low-poly, mechanical, organic, or
  another clear direction;
- **target** — Java block, GeckoLib 5, Bedrock, GLB, or glTF;
- **game version** — choose one of the versions shown for a Minecraft target;
- **structure** — important parts, proportions, symmetry, and articulation;
- **forward** — the exact direction the face, feet, toes, wheels, or tracks
  travel toward;
- **surface** — base-color palette, material separation, and focal details;
- **motion** — for an animated target, required clips, pace, weight, and loop
  behavior.

```text
Create a moonlit fantasy kirin for GeckoLib 5.
Keep the silhouette readable at Minecraft scale, place the eyes clearly for
front and three-quarter views, use a restrained blue-gold pixel palette,
and add calm idle and alert animation clips.
```

Avoid starting with a long list of individual cubes. The agent can establish a
better hierarchy when it understands the final silhouette and motion first.

## Select authoring authorities

For a new agent-authored asset, ashfox selects one broad archetype and focused
specialists from request and reference provenance before modeling. The
archetype owns the body slots and every attachment port. Specialists contribute
role, surface, silhouette, or motion policies without replacing that topology.
The resulting plan covers parts such as head, torso, paired limbs, body column,
four-foot stance, functional core, and grounded specialist contributions.

Ask the agent to report the selected archetype, specialists, and claims when
the request crosses body plans. If no archetype provides the required body
plan or attachment ports, the agent must report that the route is unsupported.

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
  Review the compiled rest pose to ensure each focal glyph remains visible and
  contrasts with its host.
- Let ashfox derive the tonal pixel surface pattern from each base color.
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
