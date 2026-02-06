# UV Atlas Guide

Internal UV atlas runs automatically on cube add/scale.

Key points:
- UV rects must not overlap.
- The atlas assigns one rect per face (no sharing).
- When packing overflows, resolution doubles and packing retries.
- If the atlas still overflows, bbmcp lowers `uvPixelsPerBlock` automatically to fit.
- Rect sizes are computed from the starting resolution; increasing size adds space instead of scaling UVs.

After apply:
- Preflight is internal-only.
- Repaint textures using the new mapping (pixels are reprojected to follow the new UVs).
