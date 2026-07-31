# ashfox Engine Core

Pure TypeScript domain model, invariants, command contracts, and deterministic
asset exporters for the standalone ashfox engine.

Host-independent UV packing and deterministic pixel-surface generation also
live here so the Web Studio and Blockbench compatibility track use one
calculation authority.

This package must not import React, browser DOM APIs, Three.js, MCP transport
types, Blockbench globals, or persistence implementations.

Implemented targets:

- deterministic canonical project JSON;
- Minecraft Java block resource-pack model bundles;
- Minecraft Bedrock geometry and actor-animation resource-pack bundles;
- GeckoLib 5-compatible geometry and actor-animation bundles;
- glTF 2.0 JSON, external-resource GLB, and self-contained GLB binaries.

Target export validates the document first and returns logical JSON files and
blob-copy entries. Self-contained GLB export instead accepts an injected async
blob resolver and returns exactly one binary model. Directory/ZIP
materialization belongs to the application layer.

The constrained modeling authority, algorithms, invariants, and proof boundary
are specified in
[Constrained Modeling Kernel](../../docs/architecture/constrained-modeling-kernel.md).

The runtime dependency direction, ownership map, and extension paths are in
[Codebase map](../../docs/architecture/codebase.md).
