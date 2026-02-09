# @ashfox/backend-engine

Engine backend scaffold for the future Ashfox clean-room runtime.

Current behavior:
- Exposes backend health as `degraded`.
- Returns `not_implemented` for all tool calls.

This package defines the hand-off point where engine-core execution will be integrated.
