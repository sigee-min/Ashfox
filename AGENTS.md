# Repository agent bootstrap

Before changing this repository:

1. Read [development-manifest.json](development-manifest.json), the versioned
   authority for product experience, engineering, workflow, commit,
   versioning, quality, and architecture rules. Its closed schema is
   [development-manifest.schema.json](development-manifest.schema.json).
2. Use [CONTRIBUTING.md](CONTRIBUTING.md) for the human onboarding map and
   verification commands, not as a second rule source.
3. Read [docs/architecture/codebase.md](docs/architecture/codebase.md) for
   ownership and dependency boundaries relevant to the change.

Do not confuse the repository development manifest with the generated Web
Studio `/workbench/agent-manifest.json`. The latter is sourced from
`apps/web/src/features/agent/agentManifest.ts` and is the runtime contract for
an agent creating an asset. Do not copy either manifest's rules into this
bootstrap file.
