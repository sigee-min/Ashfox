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
- `ASHFOX_PERSISTENCE_FAIL_FAST` (default `true`; if `false`, start even when persistence readiness is degraded)
- `ASHFOX_PERSISTENCE_PRESET` (`local` | `selfhost` | `ashfox`, default `local`, legacy alias `supabase`)
- `ASHFOX_DB_PROVIDER` (`sqlite` | `postgres` | `ashfox`, legacy alias `supabase`) overrides preset DB selection
- `ASHFOX_STORAGE_PROVIDER` (`fs` | `s3` | `ashfox`, legacy alias `supabase`) overrides preset storage selection
- `ASHFOX_STORAGE_FS_ROOT` (default `.ashfox/storage`) when `ASHFOX_STORAGE_PROVIDER=fs`
- `ASHFOX_DB_SQLITE_PATH` (default `.ashfox/local/ashfox.sqlite`) when `ASHFOX_DB_PROVIDER=sqlite`
- `ASHFOX_DB_SQLITE_TABLE` (default `ashfox_projects`)
- `ASHFOX_DB_SQLITE_MIGRATIONS_TABLE` (default `ashfox_schema_migrations`)
- `ASHFOX_DB_POSTGRES_URL` (default `postgresql://ashfox:ashfox@postgres:5432/ashfox`)
- `ASHFOX_DB_POSTGRES_SCHEMA` / `ASHFOX_DB_POSTGRES_TABLE` (default `public` / `ashfox_projects`)
- `ASHFOX_DB_POSTGRES_MIGRATIONS_TABLE` (default `ashfox_schema_migrations`)
- `ASHFOX_DB_ASHFOX_URL` (optional direct connection string override)
- `ASHFOX_DB_ASHFOX_HOST` (default `database.sigee.xyx`)
- `ASHFOX_DB_ASHFOX_PORT` (default `5432`)
- `ASHFOX_DB_ASHFOX_USER` / `ASHFOX_DB_ASHFOX_PASSWORD` / `ASHFOX_DB_ASHFOX_NAME` (default `postgres` / empty / `postgres`)
- `ASHFOX_DB_ASHFOX_SSL` (default `true`)
- `ASHFOX_DB_ASHFOX_MIGRATIONS_TABLE` (default `ashfox_schema_migrations`)
- `ASHFOX_STORAGE_S3_REGION` (default `us-east-1`)
- `ASHFOX_STORAGE_S3_ENDPOINT` (optional, for self-host/minio)
- `ASHFOX_STORAGE_S3_ACCESS_KEY_ID` / `ASHFOX_STORAGE_S3_SECRET_ACCESS_KEY` (required for `s3`)
- `ASHFOX_STORAGE_S3_SESSION_TOKEN` (optional)
- `ASHFOX_STORAGE_S3_FORCE_PATH_STYLE` (default `true`)
- `ASHFOX_STORAGE_S3_KEY_PREFIX` (optional)
- `ASHFOX_STORAGE_ASHFOX_URL` (default `https://database.sigee.xyx`)
- `ASHFOX_STORAGE_ASHFOX_SERVICE_KEY` (required for `ashfox`)
- `ASHFOX_STORAGE_ASHFOX_KEY_PREFIX` (optional)
- `ASHFOX_STORAGE_ASHFOX_UPSERT` (default `true`)

Current persistence adapter status:
- `local` preset: `sqlite` + `fs` (zero-config)
- `postgres`: implemented (`pg`)
- `ashfox` managed DB: implemented (`pg`, default host `database.sigee.xyx`)
- `fs` storage: implemented
- `s3` storage: implemented (`@aws-sdk/client-s3`)
- `ashfox` managed storage: implemented (Supabase Storage compatible HTTP API)

Preset sample env files:
- `deploy/env/presets/local.env.example`
- `deploy/env/presets/selfhost.env.example`
- `deploy/env/presets/ashfox.env.example`
