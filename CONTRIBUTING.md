# Contributing

Thanks for contributing to ashfox.

The versioned [development manifest](development-manifest.json) is the
repository development authority. Its
[closed schema](development-manifest.schema.json) and validator prevent this
guide from becoming a second, drifting rule source. This file only explains
how to find and apply that contract.

## Start with the manifests

- Repository contributors and coding agents read
  [`development-manifest.json`](development-manifest.json). Its
  `productExperience`, `engineering`, `workflow`, `versioning`, `quality`, and
  `architecture` sections declare the applicable rules.
- Agents operating the Web Studio fetch the generated
  `/workbench/agent-manifest.json`, whose source is
  [`apps/web/src/features/agent/agentManifest.ts`](apps/web/src/features/agent/agentManifest.ts).
  That runtime manifest declares asset-creation commands and workflow; it does
  not govern repository development.
- Human guides explain both workflows but do not replace either manifest.
  Integrators fetch the current runtime manifest rather than embedding a copy.

Read [the codebase map](docs/architecture/codebase.md) for rationale and an
ownership map after reading the development manifest.

## Project areas

- `apps/web` — the browser-local ashfox studio.
- `apps/site` — the landing page and published user guides.
- `packages/engine-core` — host-independent project types, commands,
  validation, and exporters.
- `packages/blockbench-*` and `apps/blockbench-*` — the optional Blockbench MCP
  compatibility track.
- `docs` — task-oriented user documentation published at
  [ashfox.io/docs](https://ashfox.io/docs/).

Keep the web studio and Blockbench compatibility track independently buildable.
Share format contracts and fixtures through their existing package boundaries;
do not import Blockbench runtime code into the web product.

Keep filenames local to their owner. Put shared contracts at
`owner/contract.ts`, group tests below a workspace owner declared in the
development manifest, and use one lowercase word such as `reader.test.ts` or
`raster.test.ts`; fixtures, runners, and support modules follow the same
one-word filename rule. Tests-only workspaces use semantic owners; product
workspaces use the production responsibility they exercise. The development
manifest and architecture gate are authoritative for the exact owner list,
extension, limits, and discovery semantics.

## Development setup

```bash
npm install
npm test
npm run build
```

Useful focused commands:

```bash
npm run dev:web
npm run test:site
npm run test:web
npm run test:blockbench
npm run build:public
npm run build:blockbench
```

Run the complete quality gate before a substantial pull request:

```bash
npm run quality
```

## Apply the development manifest

The manifest's `workflow` section identifies the change lifecycle and the
verification profile. `engineering.testing` defines behavioral coverage, and
`architecture` and `quality` feed the automated gates. Validate the manifest
and its consumers with:

```bash
node scripts/quality/manifest/index.js
npm run quality:check
```

Edit the manifest only when intentionally changing repository policy. Change
its schema, validator fixtures, consuming gates, and this navigation text in
the same reviewable change.

## Code conventions

Use `engineering.style` and `engineering.principles` in the development
manifest as the rule source. The [codebase map](docs/architecture/codebase.md)
explains how those rules map to concrete package boundaries.

## Tests

The required behavioral and stateful paths are declared in
`engineering.testing`. Use focused workspace tests while iterating and the
verification commands declared by `workflow.verification` before handoff and
pull request.

## Pull requests

Use `workflow` for scope and generated-artifact policy. In the PR description,
explain the user-visible outcome, why it is needed, and which declared checks
you ran.

## Commit messages

`workflow.commits` is the authority for format, allowed types, subject style,
atomicity, and breaking-change review. release-please consumes that declared
commit format when preparing a release.

## Versioning

The manifest's `versioning.product`, `versioning.intentProgram`, and
`versioning.deliveryTargets` entries deliberately separate product releases,
the persisted source compatibility contract, and transient delivery inputs.
Follow their named authorities, ownership, version, and verification fields;
do not infer one version from another.

## Reporting bugs

Open an issue with:

- expected behavior
- actual behavior
- reproduction steps
- ashfox version or commit
- affected surface: web studio or Blockbench MCP
- browser and export target, or Blockbench version and model format

For security issues, follow [SECURITY.md](SECURITY.md).
