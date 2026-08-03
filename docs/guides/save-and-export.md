# Export a Finished Asset

Tell the agent which target will consume the asset. It builds against that
target, completes the required visual reviews, and delivers the prepared
artifact.

## Create a project with the right settings

Include the project settings in the first request:

- **Name** — the human-readable project name;
- **Format** — Java block, GeckoLib 5, Bedrock, GLB, or glTF;
- **Game version** — one of the versions offered for a Minecraft format.

```text
Create a GeckoLib 5 project named Ember Stag.
```

Ashfox uses its fixed iconic form scale and grows the generated atlas as
needed. Export-safe resource identifiers are derived from the project and
validated automatically.

## Export a finished asset

```text
Validate the current project for its configured target.
Fix blocking findings, export it, deliver the artifact to artifacts/, and
verify the final filename, extension, and size.
```

Java block, GeckoLib 5, Bedrock, and glTF use ZIP when the target needs several
related files. GLB can contain geometry, animation, and textures in one binary.

Export adapts a copy of the canonical project to the configured profile. It may
bake portable values or leave out target-only events, but it does not delete
source clips or events. The export result includes a structured receipt of every
converted or omitted item alongside the prepared artifact metadata.

See [Choose an export format](choose-a-format.md) for the exact result of each
option.

## Verify delivery

The agent reports an artifact only after the workbench validates the current
revision and returns its target, filename, byte length, and SHA-256 content
hash. It also returns the adaptation count and the structured `converted` and
`omitted` receipt. An omitted item is absent from that artifact only; it remains
editable in the project. The agent then transfers that exact prepared artifact
and verifies the final location.

Expected extensions:

- multi-file target: `.zip`;
- embedded 3D asset: `.glb`.
