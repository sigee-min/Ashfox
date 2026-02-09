# Ashfox Worker App

This app is the async worker shell for future engine-side jobs.

Current scope:
- Boots a worker process.
- Performs periodic backend heartbeat checks.
- Provides a stable process boundary for future queue consumers (render/export/batch jobs).

Environment variables:
- `ASHFOX_WORKER_LOG_LEVEL` (default `info`)
- `ASHFOX_WORKER_HEARTBEAT_MS` (default `5000`)
