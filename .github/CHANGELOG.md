# Changelog

## [0.0.5](https://github.com/sigee-min/ashfox/compare/v0.0.4...v0.0.5) (2026-02-26)

### Bug Fixes

* persist endpoint host/port/path settings across plugin reloads and expose runtime server mode/status
* fix `ensure_project` delete flow when Blockbench close is async
* harden `paint_mesh_face` commit validation by reading updated canvas source first
* harden native export compatibility around `compileAdapter` failures and fallback handling
* add regression tests for endpoint persistence, runtime status, texture source selection, export fallback, and async close
