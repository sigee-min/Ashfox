# Export a Finished Asset

Ashfox first compiles one target-independent canonical asset from the confirmed
Intent Program. Choose a delivery adapter only when you are ready to export.

## Create the canonical project

The project itself needs only a name. Describe the asset's form, support,
surface, and motion in its Intent Program; do not include coordinates or a
delivery target.

- **Name** — the human-readable project name.

```text
Create a project named Ember Stag.
```

Ashfox uses its fixed iconic form scale and grows the generated atlas as
needed. Export-safe resource identifiers are derived from the project and
validated automatically.

## Export a finished asset

```text
Open **Export**, choose Java block, GeckoLib 5, Bedrock, GLB, or glTF, and
provide a Minecraft game version, namespace, and path only when that adapter
needs them. Fix any adapter-specific finding, then export and verify the final
filename, extension, and size.
```

Java block, GeckoLib 5, Bedrock, and glTF use ZIP when the target needs several
related files. GLB can contain geometry, animation, and textures in one binary.

Export adapts a copy of the canonical project to the selected adapter. It may
bake portable values or leave out target-only events, but it does not delete
source clips or events. The export result includes a structured receipt of every
converted or omitted item alongside the prepared artifact metadata.

See [Choose an export format](choose-a-format.md) for the exact result of each
option.

## Verify delivery

The Export menu reports target-specific compatibility failures before writing an
artifact. A successful export returns the filename, byte length, SHA-256 content
hash, and structured `converted` and `omitted` receipt. An omitted item is
absent from that artifact only; it remains in the canonical project.

Expected extensions:

- multi-file target: `.zip`;
- embedded 3D asset: `.glb`.
