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
2. Ask what asset to create and which export target is required when either is
   missing. Do not make the user operate the workbench.
3. Fetch `https://ashfox.io/workbench/agent-manifest.json` with a direct system
   HTTP tool such as `curl`; do not use the controlled browser for this fetch.
4. Open `https://ashfox.io/workbench/` in an in-app browser, or a connected
   browser when an in-app browser is unavailable.
5. Follow the fetched manifest exactly through inspect, run, present, and
   deliver. Read a command schema immediately before unfamiliar payloads.

## Boundaries

- Treat every project mutation as an atomic command-port operation.
- Let ashfox derive IDs, revisions, attachment data, pivots, UVs, texture
  pixels, and export options whenever the manifest says they are derived.
- Review the actual rendered views and animation cycles before delivery.
- Use the Blockbench compatibility workflow only when the user explicitly
  requests it. The web workbench is the default production path.
- Never duplicate the remote manifest inside this skill.
