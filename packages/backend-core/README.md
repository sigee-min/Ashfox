# @ashfox/backend-core

Shared backend contracts for Ashfox multi-runtime orchestration.

Current scope:
- Backend port interface (`BackendPort`)
- Backend registry (`BackendRegistry`)
- Project lock manager (`ProjectLockManager`)
- Tool error helper (`backendToolError`)

This package is runtime-agnostic and intentionally does not depend on Blockbench globals.
