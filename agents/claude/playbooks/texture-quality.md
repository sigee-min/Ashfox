# Claude Playbook: Texture Quality

After `paint_faces`, check:
- `targets=1`, `opsApplied=1`
- `changedPixels` aligns with expectation
- `resolvedSource` is intended (`face` default)
- `validate` has no new UV regressions
- `read_texture` hash/byteLength is sane

If any check fails, halt writes and produce QA report.

