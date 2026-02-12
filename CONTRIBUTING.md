# Contributing

Thanks for contributing to `ashfox`.

## Development Setup
```bash
npm install
npm run build
npm test
```

Recommended full check before opening a PR:
```bash
npm run quality
```

## Architecture and Code Style
- Keep pure logic in `src/domain/`.
- Keep host/IO integrations in adapters/transport layers.
- TypeScript strict mode is required; avoid `any`.
- Use 2-space indentation, single quotes, and semicolons.

## Docs Authoring Standard
- For docs content changes, follow:
  - `/en/docs/contributors/project/docs-writing-standard`
  - `/ko/docs/contributors/project/docs-writing-standard`
- Keep docs task-focused and readable for first-time users.
- Keep SEO/LLM signal text in metadata and headings, not as repeated body text.
- Run docs checks before PR:
```bash
npm run docs:quality
npm --workspace ./apps/docs run build
```

## Pull Requests
- Keep PR scope focused and reviewable.
- Add or update tests for behavioral changes.
- Update docs when tool schemas or behavior change.
- Include test/quality results in the PR description.
- Fill out `.github/pull_request_template.md` (docs checklist required when docs change).

## Commit Messages
Use short imperative subjects, optionally with prefixes:
- `fix: ...`
- `refactor: ...`
- `docs: ...`
- `test: ...`

## Reporting Bugs
Open an issue with:
- expected behavior
- actual behavior
- reproduction steps
- environment details (Blockbench version, ashfox version, format)

For security issues, use `SECURITY.md`.
