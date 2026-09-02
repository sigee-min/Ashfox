---
name: ashfox
description: Create, edit, review, animate, and export game-ready low-poly assets in the ashfox web workbench through an AI agent. Use for low-poly modeling, deterministic textures and UVs, rigs, idle or motion animation, GLB, Bedrock, or GeckoLib exports, and Blockbench-free asset production.
---

# ashfox

Use ashfox as the visual execution environment. Keep its live machine manifest
as the only authority for commands, schemas, quality rules, and delivery.

## Start

1. Resolve `scripts/sync.py` relative to this `SKILL.md`, then run it with the
   system Python. This checks the ashfox release descriptor over HTTPS and
   atomically installs verified skill files when an update exists. If the
   installed directory is read-only, continue with the live manifest rather
   than editing files manually.
2. Ask what asset to create when it is missing. Do not ask for an export target
   until the user is ready to deliver; delivery settings are not project or
   compiler input. Do not make the user operate the workbench.
3. Fetch `https://ashfox.io/workbench/agent-manifest.json` with a direct system
   HTTP tool such as `curl`; do not use the controlled browser for this fetch.
4. Open `https://ashfox.io/workbench/` in an in-app browser, or a connected
   browser when an in-app browser is unavailable.
5. Follow the fetched manifest exactly through inspect, run, present, and
   deliver. Read a command schema immediately before unfamiliar payloads.

## Boundaries

- Treat every project mutation as an atomic command-port operation.
- Keep the complete `ashfox-model 1` source as the sole modeling authority.
  Author IDs, cube attachment relationships, pivots, named texture charts,
  chart origins, local patterns, optional voxel tone, stamps, and motion
  explicitly in that source. Only canonical lowering, validation evidence, and
  target export serialization are derived.
- Place each cube with either an explicit canonical model-space
  `origin`, or the complete `attach`, `attach-face`, `offset: vec2<unit>`, and
  `inset: unit` relation. Resolve offsets from the target face's minimum corner:
  north/south `(x, y)`, east/west `(z, y)`, up/down `(x, z)`. Signed offsets may
  create deliberate overhangs. The opposite child face contacts the target;
  `inset = 0u` is contact and positive inset is
  explicit overlap smaller than the child's normal thickness. Require positive
  tangent overlap and the same compose namespace, lexical bone, and mirror
  context. Attached cubes are axis-aligned and neither they nor their targets
  may carry cube-level `position`, `rotation`, `pivot`, `inflate`, or `mirror`.
  Origins are model-space, not parent-local. Attach is an exact relation, not a
  fuzzy solver or tolerance request; planes cannot be attached and no canonical
  attach field is emitted.
- `compose` is legal only below a lexical bone, including a template, repeat,
  or mirror body. Lexical nesting owns the parent only.
- Use the fetched manifest’s current closed authored model grammar. Do not rely
  on implicit geometry, pivots, chart bindings, chart origins, materials, or
  keyframes; revise the owning source declaration when validation or review
  finds a problem.
- Treat every plane as a manifest-governed exception, not a shortcut for a
  thin-looking mass. If an attached feature needs readable thickness or a
  contact face, keep it in economical volume geometry and reject coplanar
  overlays or edge-on disappearance during review.
- Review the actual rendered views and animation cycles before delivery.
- After the accepted review, use the sole `window.ashfox.capture({kind:"build"})`
  request for Build replay. It starts from an empty scene, places every visible
  element in deterministic canonical element order, applies each element's
  complete owning texture set atomically, activates canonical authored idle
  motion when available, and holds on the complete model. The replay is
  non-persistent, transient source-derived evidence, not a modeling authority
  or decision/history log.
- Never duplicate the remote manifest inside this skill.
