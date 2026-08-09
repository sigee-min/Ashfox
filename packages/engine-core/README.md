# ashfox Engine Core

`@ashfox/engine-core` is the deterministic canonical-asset compiler behind the
ashfox workbench.

Its authored input is one Agent-authored, Agent-compiled version 1 Intent
Program. The parser accepts only
coordinate-free semantic declarations: explicit support and support host,
named body relationships, face or hero focal stage, supported surfaces, idle
motion, and palette. The compiler derives the canonical geometry, surface
pixels, hierarchy, rig, animation, and readiness evidence from that source.

The canonical project has no export target, game version, namespace, or model
path. Export adapters derive Java block, Bedrock, GeckoLib 5, GLB, and glTF
artifacts only after canonical compilation; an adapter cannot alter the
program or its canonical result.

This package is pure TypeScript domain code. It must not import React, browser
DOM APIs, Three.js, MCP transport types, host globals, or persistence
implementations.

Key boundaries:

- `src/project/program/language.ts` is the single closed V1 vocabulary;
  the parser and normalizer own source-span diagnostics and semantic IR.
- `src/compiler/program/` resolves an immutable compilation plan before
  lowering source into one canonical asset and
  verifies structural, support, focal, texture, rig, and motion contracts.
- `src/provenance/program/` owns SHA-256 source, semantic, and output
  projections plus compiler/specification receipt metadata.
- `src/textures/appearance/contract.ts` owns the closed Surface
  Appearance and Surface Synthesis 1 boundary described in
  [`docs/architecture/surface-appearance-v1.md`](../../docs/architecture/surface-appearance-v1.md).
- `src/export/` adapts an already-compiled canonical project for a delivery
  target.
