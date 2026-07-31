# Choose an Export Format

Choose the format used by the project that will receive the asset.

| Format | Choose it when | Download |
| --- | --- | --- |
| GeckoLib 5 | A Minecraft Java mod uses GeckoLib 5 animated models | ZIP with geometry, animation, and textures |
| Bedrock | A Minecraft Bedrock resource or behavior pack needs geometry and actor animation | ZIP with geometry, animation, and textures |
| GLB | A game engine, 3D tool, or viewer should receive one portable file | One `.glb` with embedded geometry, animation, and textures |
| glTF | A 3D pipeline prefers editable JSON and separate resources | ZIP with `.gltf`, binary data, and textures |

## GeckoLib 5

Use GeckoLib 5 for animated Minecraft Java entities, blocks, or items in a
project that already loads GeckoLib 5 assets.

The export keeps Minecraft-oriented geometry, named animation clips, textures,
and supported effect tracks. You still need to connect the files to your mod;
ashfox does not generate the consuming mod project.

## Bedrock

Use Bedrock for Minecraft Bedrock geometry and actor animation. The ZIP contains
the files needed for a resource-pack layout.

Bedrock and GeckoLib animation features are not identical. If an animation uses
an unsupported easing or effect, ashfox blocks the export and explains what
must change.

## GLB

Use GLB when you want the simplest single-file delivery. Geometry, materials,
textures, hierarchy, and transform animation can be embedded in one binary.

GLB is the best default for general 3D viewers and engines when Minecraft pack
layout is not required.

## glTF

Use glTF when another tool needs readable scene JSON or separate textures and
binary data. ashfox packages the related files together so none are omitted
from the download.

Minecraft-only expressions, sound events, particle events, and timeline events
do not have a direct glTF equivalent. Remove or replace them before exporting
to GLB or glTF.

## Delivery choices

- Embedded GLB is one finished 3D asset.
- GeckoLib 5 and Bedrock require several target files, delivered as one ZIP.
- glTF normally uses several related resources, delivered as one ZIP.

## Before exporting

Ask the agent to play every required animation, inspect texture assignment and
pixel scale, confirm the configured target, and resolve every blocking finding.
Target resource identifiers and export options are derived automatically. The
agent delivers only after every revision-bound visual review is accepted.
