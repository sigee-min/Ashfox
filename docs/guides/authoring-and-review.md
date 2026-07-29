# Create and Refine Assets

A strong first request establishes the whole asset. Short follow-up requests
then fix one visible issue at a time.

## Start with the complete result

Describe:

- **subject** — creature, vehicle, prop, block, or environment piece;
- **style** — Minecraft-like pixels, chunky low-poly, mechanical, organic, or
  another clear direction;
- **target** — GeckoLib 5, Bedrock, GLB, or glTF;
- **structure** — important parts, proportions, symmetry, and articulation;
- **surface** — palette, material separation, texture size, and focal details;
- **motion** — required clips, pace, weight, and loop behavior.

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

## Ask for exact operations when precision matters

Natural-language requests can still be exact:

- “Mirror the finished left horn to the right side.”
- “Align all wheel pivots to their axle centers.”
- “Use one pixel density across every cube face.”
- “Phase the four leg cycles evenly.”
- “Close the idle loop without changing its duration.”

ashfox applies related edits together, so Activity and Undo represent the whole
correction rather than dozens of disconnected field changes.

## Review the model

1. Check the silhouette from front, side, and three-quarter views.
2. Confirm that large forms read before small decoration.
3. Inspect eyes, windows, wheels, hands, engines, or other focal details.
4. Check that moving parts have useful pivots and do not intersect at rest.
5. Use the Studio environment for neutral judgment and Day, Evening, or Night
   to check readability under different lighting.

## Review textures and UVs

- Check that similar surfaces use the same apparent pixel size.
- Make sure each visible face has the intended texture.
- Look for stretched pixels, seams, empty faces, and accidental transparency.
- Keep important accents visible at the distance where the asset will be used.
- For Minecraft assets, prefer deliberate pixel blocks over smooth gradients.

## Review animation

1. Select the clip in **Animate**.
2. Play it once at normal speed.
3. Step through the strongest pose and the loop boundary.
4. Check feet, wheels, wings, tails, and attached parts for sliding or clipping.
5. Ask for a correction only when you can name the visible problem.

Stop refining when the silhouette, focal details, surface treatment, and motion
are readable and export validation has no blocking issue.

Next: [Save, open, export, and capture](save-and-export.md).
