# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the TypeScript source for the Blockbench plugin and MCP server. Core logic lives in `src/domain/`, orchestration/services in `src/usecases/`, interfaces in `src/ports/`, and infrastructure in `src/adapters/`, `src/transport/`, and `src/proxy/`. The optional Node sidecar entry is in `src/sidecar/`. `docs/` holds spec documentation, `scripts/` holds build/test scripts, and `dist/` is generated output (do not edit by hand).

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run build` bundles the plugin and sidecar with esbuild, producing `dist/bbmcp.js` and `dist/bbmcp-sidecar.js`.
- `npm test` runs the TypeScript tests via `scripts/tests/run.js` (ts-node) and should print `tests ok` on success.

## Coding Style & Naming Conventions
TypeScript is compiled in strict mode (see `tsconfig.json`), so avoid `any` and prefer explicit types. The codebase uses 2-space indentation, single quotes, and semicolons. Filenames follow existing patterns: services in `src/usecases/` are PascalCase (e.g., `ToolService.ts`), helpers/utilities are lowerCamel (e.g., `textureTools.ts`). Keep pure, reusable logic in `src/domain/` and keep IO or host integrations in adapters/transport.

## Testing Guidelines
Tests live in `scripts/tests/*.test.ts` and use `node:assert/strict`. Add new tests alongside existing ones and register them in `scripts/tests/run.js`. Favor deterministic, fast unit tests (no network or filesystem dependencies) to keep the test runner quick.

## Commit & Pull Request Guidelines
Commit messages follow an imperative style, often with a lightweight type prefix (e.g., `refactor: ...`, `Fix ...`, `Add ...`, `Update ...`). Keep subjects short and descriptive. PRs should include a clear summary, scope of changes, and testing notes (e.g., `npm test`). If you modify tool schemas or specs, update relevant docs in `docs/` and include a small example payload or output in the PR description.

## Configuration Notes
Default MCP settings live in `src/config.ts` (host `127.0.0.1`, port `8787`, path `/mcp`). If you change defaults, update `README.md` to keep the quickstart accurate.
