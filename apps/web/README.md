# Ashfox Web Studio

Zero-install, browser-local authoring surface.

Current scope:
- canonical `ProjectDocument` live preview;
- Three.js WebGL2 viewport with orbit and transform controls;
- on-demand scene and inspector overlays;
- responsive full-area viewport from desktop down to narrow in-app panes;
- IndexedDB project persistence with revisioned command receipts;
- DOM-native new project, archive input, save, export, and capture workflows;
- cross-tab revision notification through `BroadcastChannel`;
- validation, textures, animation timeline, activity, undo, and redo;
- shared Studio, Day, Evening, and Night viewport/capture environments;
- local 10fps Build process and Animation GIF capture with semantic events;
- cancellable project file operations with stale-completion protection;
- self-contained `.ashfox` project archives with verified texture bytes;
- one persistent browser artifact handoff for save, export, and capture;
- single machine-readable AI IDE workflow in `agent-manifest.json`, backed by
  reducer outcomes;
- static production build with no application server routes.

Run locally:

```bash
cd apps/web
npm install
npm run dev
```

Architecture:

- Keep the viewport dominant; secondary tools open as overlays.
- The browser-local `ProjectDocument` is the only writable project authority.
- IndexedDB uses revision compare-and-write and cannot roll back newer state.
- Three.js objects are disposable render projections.
- UI actions and the Agent Command Port submit the same canonical commands.
- `/agent-manifest.json` is the machine authority for AI IDE operation and
  host-side artifact delivery.
- Blockbench, MCP, Node persistence, SQLite, and worker packages are forbidden
  dependencies.
