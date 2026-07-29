# Ashfox

Ashfox is a zero-install web studio for deterministic 3D modeling, texturing,
animation, validation, and export. The browser product owns its project data
locally and does not require Blockbench, a local daemon, a database server, or
an MCP connection.

An optional Blockbench compatibility track remains available for existing MCP
workflows. It is built and tested independently and cannot be imported by the
web product.

## Product tracks

### Web Studio

- one canonical `ProjectDocument` with stable IDs;
- compact Three.js workbench optimized for agent-authored results;
- browser-local revision history and persistence;
- Bedrock, GeckoLib 5, glTF 2.0, GLB, and Minecraft Java export;
- no install, account, backend provider, or Blockbench runtime.

### Blockbench MCP compatibility

- existing MCP tools, schemas, Blockbench adapters, and sidecar behavior;
- isolated packages under `packages/blockbench-*`;
- optional artifacts `dist/ashfox.js` and `dist/ashfox-sidecar.js`.

## Development

```bash
npm install
npm run dev:web
npm run test
npm run build
```

Build one track independently with `npm run build:web` or
`npm run build:blockbench`.

Architecture, product, UX, and migration contracts are maintained in
[`docs/`](docs/README.md).

## License

MIT. See `LICENSE`.
