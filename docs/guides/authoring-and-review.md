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
- “Close the idle loop without changing its duration.”

ashfox applies related edits together, so Activity and Undo represent the whole
correction rather than dozens of disconnected field changes. The semantic part
recipe remains the authoring authority; generated cubes and UV coordinates are
derived output.

## Review the model

Ask the agent to render front, side, and three-quarter views in Studio
lighting, then check Day, Evening, and Night when lighting readability matters.
Have it verify that large forms read before decoration, focal details remain
visible, and moving parts have useful pivots without resting intersections.

## Review textures and UVs

- Ask the agent to choose Surface detail before the first geometry: 1× for
  one-unit pixels, 2× for half-unit pixels, or 4× for quarter-unit pixels.
  Changing it later requires deleting every compiled part first.
- Check that material regions use deliberate, reusable base colors.
- Make sure each visible face belongs to the generated atlas.
- Look for stretched pixels, seams, empty faces, and mismatched material color.
- Confirm that one square pixel has exactly the same size on every face.
- Keep important accents visible at the distance where the asset will be used.
- Use one zero-depth eye feature per visible eye. Its iris base color, face,
  anchor, and pixel size are authored once; ashfox derives the outline, pupil,
  highlight, UV projection, and atlas pixels. Do not stack eye cubes.
- Let ashfox derive the tonal pixel surface pattern from each base color.
  Coplanar generated surfaces share world-lattice pattern coordinates, so a
  cuboid split does not restart the pattern.

## Review animation

Ask the agent to play each clip once at normal speed and inspect its strongest
pose and loop boundary. Have it check feet, wheels, wings, tails, and attached
parts for sliding or clipping. Request a correction only when the visible
problem can be named.

Stop refining when the silhouette, focal details, surface treatment, and motion
are readable and export validation has no blocking issue.

Next: [Export a finished asset](save-and-export.md).
