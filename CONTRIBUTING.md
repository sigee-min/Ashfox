# Contributing

Thanks for contributing to ashfox.

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

## Code conventions

- Keep one authority for each piece of project state.
- Route web project mutations through the canonical command reducer.
- Keep `engine-core` free of React, browser, filesystem, and Blockbench APIs.
- Keep browser and Blockbench I/O in adapters at their respective boundaries.
- Prefer immutable transitions and stable IDs.
- Give each module and function one clear responsibility.
- TypeScript strict mode is required; avoid `any`.
- Use 2-space indentation, single quotes, and semicolons.

## Tests

- Add regression coverage for behavioral changes.
- Exercise success, cancellation, stale revision, invalid input, and exception
  paths when changing stateful workflows.
- Update exporter fixtures when output contracts intentionally change.
- Keep user-visible documentation aligned with the behavior shipped in the
  same change.

## Pull requests

- Keep PR scope focused and reviewable.
- Explain the user-visible outcome and why the change is needed.
- Include the checks you ran.
- Do not commit generated `dist`, local project files, secrets, or editor state.

## Commit messages

Use short imperative subjects, optionally with prefixes:

- `fix: ...`
- `feat: ...`
- `refactor: ...`
- `docs: ...`
- `test: ...`

## Reporting bugs

Open an issue with:

- expected behavior
- actual behavior
- reproduction steps
- ashfox version or commit
- affected surface: web studio or Blockbench MCP
- browser and export target, or Blockbench version and model format

For security issues, follow [SECURITY.md](SECURITY.md).
