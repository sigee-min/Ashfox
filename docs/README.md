# ashfox Docs

ashfox has one authored asset authority: an Agent-authored and Agent-compiled
Intent Program. It is a
small, coordinate-free description of the asset’s classification, orientation,
support contacts, topology, attachment anchors, morphology, focal stage, idle
mode, supported surfaces, and appearance. The compiler derives the canonical
model from that source.

The browser workbench is local-first: create a named project, prompt the Agent,
observe its temporary candidate and compiled result, then download, capture, or
select an export adapter for the receiving runtime.

## Start in three steps

1. Follow [Get started](guides/ai-agent-quick-start.md).
2. Describe the asset in ordinary language.
3. Watch the Agent build and review it, then export or capture the result.

The Agent authors, validates, stages, decides, compiles, and visually reviews.
It never directly patches compiler-owned model data. A changed requirement
means a new prompt, revised program, and atomic compilation.

## What you can make

- creatures, figures, props, vehicles, and other assets from coordinate-free
  structural modules;
- compact essential assets and detailed hero assets;
- standing, base-supported, wheel-grounded, and contact-free neutral assets;
- bilateral or explicitly asymmetric forms, with compiler-enforced reflected
  surfaces and exactly one hero focal stage where required;
- generated pixel surfaces, canonical hierarchy, and source-declared idle
  motion;
- Java block, GeckoLib 5, Bedrock, GLB, and glTF delivery artifacts.

## Choose a guide

- [Get started](guides/ai-agent-quick-start.md) — create and compile a first
  Intent Program.
- [Create and refine](guides/authoring-and-review.md) — write source that
  expresses the intended result and review it safely.
- [Export a finished asset](guides/save-and-export.md) — deliver an artifact
  without changing the project.
- [Choose an export format](guides/choose-a-format.md) — select an adapter at
  delivery time.
- [Troubleshooting](guides/troubleshooting.md) — resolve proposal,
  compilation, review, export, and download problems.

## Develop or integrate

- [Development manifest](https://github.com/sigee-min/ashfox/blob/main/development-manifest.json)
  is the versioned authority for repository product, engineering, workflow,
  versioning, quality, and architecture rules.
- [Repository contribution rules](https://github.com/sigee-min/ashfox/blob/main/CONTRIBUTING.md?plain=1)
  explain how contributors consume that manifest.
- [Codebase map](architecture/codebase.md) defines ownership, dependency
  direction, and structural gates.
- [Intent Program 1](architecture/intent-program-v1.md) defines the four source
  authorities, orthogonal vocabulary, typed statement schemas, and compiler
  stage boundaries.
- [Surface Appearance V1](architecture/surface-appearance-v1.md) separates the
  implemented base-dominant material field, semantic source markings, and
  generated raw-raster provenance contract.
- [Web Studio integration notes](https://github.com/sigee-min/ashfox/blob/main/apps/web/README.md?plain=1#agent-manifest-consumers)
  explain how a host consumes the runtime agent manifest. The published
  runtime manifest governs Studio asset creation and is distinct from the
  repository development manifest.

## Your files stay local

ashfox stores the working project in your browser. It does not require a
database or project upload. An artifact leaves the browser only when you
export it.
