# @ashfox/backend-blockbench

Blockbench backend adapter for the Ashfox backend port.

Current behavior:
- Delegates tool calls to an injected runtime dispatcher.
- Reports `offline` health when dispatcher is absent.
- Returns explicit `invalid_state` errors when offline.
