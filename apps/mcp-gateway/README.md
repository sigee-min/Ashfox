# Ashfox MCP Gateway App

This app is the multi-backend MCP gateway shell.

Current scope:
- Starts an MCP endpoint using `@ashfox/runtime` transport/server.
- Routes tool calls through a backend registry (`engine` or `blockbench`).
- Serializes mutating calls per project via `ProjectLockManager`.

Environment variables:
- `ASHFOX_HOST` (default `127.0.0.1`)
- `ASHFOX_PORT` (default `8790`)
- `ASHFOX_PATH` (default `/mcp`)
- `ASHFOX_GATEWAY_BACKEND` (`engine` | `blockbench`, default `engine`)
