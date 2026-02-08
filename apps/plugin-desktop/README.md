# Ashfox Desktop Plugin App

This app is the desktop plugin entry layer.

Current role:
- Own the plugin bundle entrypoint (`apps/plugin-desktop/src/index.ts`).
- Delegate runtime logic to the existing core implementation under `src/`.

Build output is still produced at:
- `dist/ashfox.js`

Migration intent:
- Keep runtime behavior stable while gradually moving plugin-specific wiring from `src/plugin*` into this app boundary.
