# Ashfox Headless MCP App

This app is the headless MCP server entry layer.

Current role:
- Own the sidecar bundle entrypoint (`apps/mcp-headless/src/index.ts`).
- Delegate runtime logic to the existing sidecar implementation under `src/sidecar`.

Build output is still produced at:
- `dist/ashfox-sidecar.js`

Migration intent:
- Keep sidecar compatibility while introducing a clean boundary for a future UI-less headless runtime.
