# Ashfox Web App

Next.js scaffold for a combined dashboard + API server deployment.

Current scope:
- Dashboard shell (`/`)
- Health API (`/api/health`)
- MCP API placeholder (`/api/mcp`)

Run locally:

```bash
cd apps/web
npm install
npm run dev
```

Design intent:
- Use Next.js route handlers for API control endpoints.
- Keep heavy MCP execution in `apps/mcp-gateway`.
- Keep async/batch operations in `apps/worker`.
