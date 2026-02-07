# Style Profile: Minecraft Natural Shade

## Intent
Vanilla-friendly texture style with subtle hue shifts and blocky readable shading.

## Palette Rules
- Keep saturation moderate.
- Avoid pure black and pure white.
- Prefer warm highlights and cool shadows by small hue shifts.

## Shading Rules
- Light direction: top-left by default.
- Use 2-4 tonal steps for major surfaces.
- Keep micro-noise low; prioritize clean readable planes.

## Geometry Rules
- Preserve simple voxel silhouette.
- Avoid over-segmentation unless needed for animation.

## Failure Signals
- Flat single-color faces for large surfaces.
- High-frequency noise that kills readability.
- Inconsistent light direction between adjacent faces.
