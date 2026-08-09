# ashfox Web Studio

Zero-install, browser-local observation and delivery surface for AI-authored
assets.

Current scope:
- canonical `ProjectDocument` live preview;
- Three.js WebGL2 viewport with orbit, camera presets, and environment controls;
- responsive full-area viewport from desktop down to narrow in-app panes;
- IndexedDB persistence of exact Intent Program source and project identity;
- human-operated new, open, project download, export, and capture boundaries;
- cross-tab revision notification through `BroadcastChannel`;
- compiler validation, derived textures, and motion playback;
- shared Studio, Day, Evening, and Night viewport/capture environments;
- local 10fps build-process and animation GIF capture with semantic events;
- AI-authored and AI-compiled Intent Program assets, automatic ephemeral
  visual feedback, and a compact creation-status rail;
- cancellable project file operations with stale-completion protection;
- plain UTF-8 `.ashfox` Intent Program sources compiled atomically on open;
- one persistent browser artifact handoff for save, export, and capture;
- one generated machine-readable AI agent workflow with canonical command
  schemas and reducer outcomes;
- static production build with no application server routes.

Run locally:

```bash
cd apps/web
npm install
npm run dev
```

Architecture:

- Keep the viewport dominant and the human surface observation-only except for
  project, view, playback, capture, and delivery controls.
- The current compiled Intent Program source is durable authority; `ProjectDocument`
  is a disposable compiler projection rebuilt on open and restore.
- IndexedDB uses revision compare-and-write and cannot roll back newer state.
- Three.js objects are disposable render projections.
- The Agent Command Port owns Intent Program proposal and compilation. Human UI
  actions do not decide or mutate asset semantics.
- `/workbench/agent-manifest.json` is the machine authority for AI agent operation and
  host-side artifact delivery.
- Blockbench, MCP, Node persistence, SQLite, and worker packages are forbidden
  dependencies.

## Agent manifest consumers

`/workbench/agent-manifest.json` is the machine authority for an agent that
operates the Studio. It is generated from
`src/features/agent/agentManifest.ts`; do not hand-edit built output or treat a
README, prompt example, or cached command schema as an equivalent contract.
Its `authoring.program.specification` is a JSON-safe projection of the engine's
closed language and statement-schema authority.

An integrating host should:

1. fetch the current manifest at the start of a Studio session;
2. inspect only the current command schemas named by `nextActions`;
3. lint and submit complete proposals through the documented command port,
   then autonomously decide whether to revise or run the exact compile
   operation returned by inspection;
4. use inspect, present, and capture responses as revision-bound results,
   make the compilation decision without human input, and keep source editing
   out of the human surface;
5. refetch after a product update instead of assuming a cached grammar still
   applies.

This runtime asset-creation contract is distinct from the repository root
[`development-manifest.json`](../../development-manifest.json), which governs
product experience, engineering, contribution workflow, versioning, quality,
and architecture for code changes.

Repository contributors must update the manifest source, contract tests, and
affected human guide together when that workflow changes. See the root
[contribution guide](../../CONTRIBUTING.md) for how to consume the development
manifest.
