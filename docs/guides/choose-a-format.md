# Choose an Export Format

Choose the format used by the project that will receive the asset.

| Format | Choose it when | Download |
| --- | --- | --- |
| Java block | A Java resource pack needs one static block model | Resource-pack ZIP with metadata, blockstate, model, and textures |
| GeckoLib 5 | A Minecraft Java mod uses GeckoLib 5 animated models | ZIP with geometry, animation, and textures |
| Bedrock | A Bedrock project needs geometry and actor animation assets | ZIP with geometry, animation, and textures |
| GLB | A game engine, 3D tool, or viewer should receive one portable file | One `.glb` with embedded geometry, animation, and textures |
| glTF | A 3D pipeline prefers editable JSON and separate resources | ZIP with `.gltf`, binary data, and textures |

Minecraft targets also show a **Game version** setting. That setting belongs to
the project, so preview, validation, and delivery all use the same version. The
workbench lists only combinations its exporters test; it does not accept an
arbitrary version string.

For Bedrock and GeckoLib, this is the tested consumer compatibility target.
Multiple supported game versions can intentionally share the same stable
geometry or animation schema; selecting a version does not invent a different
asset payload when the consumer contract is unchanged.

The selected format is the project's default delivery profile, not a destructive
authoring mode. Changing it keeps canonical geometry, textures, hierarchy,
clips, and events. Export compiles a copy into the selected target and reports
anything it converted or omitted from that artifact.

## Java block

Use Java block for a static block that should drop into a Java resource-pack
layout. The ZIP contains `pack.mcmeta`, the blockstate, model JSON, and texture
files for the selected game version.

The receiving pack or mod must already reference the matching block resource
ID. This export supplies its visual assets; it does not register a new gameplay
block.

This target does not include animation. Canonical clips remain in the project
and the export receipt lists them as omitted from the Java block artifact.
Choose GeckoLib 5 when the receiving mod needs those clips.

## GeckoLib 5

Use GeckoLib 5 for animated Minecraft Java entities, blocks, or items in a
project that already loads GeckoLib 5 assets.

The export keeps Minecraft-oriented geometry, named animation clips, textures,
and supported effect tracks. You still need to connect the files to your mod;
ashfox does not generate the consuming mod project.

## Bedrock

Use Bedrock for Bedrock geometry and actor animation. The ZIP is an asset
fragment: connect its geometry, animation, and textures to the entity or block
definition in the consuming pack.

Bedrock and GeckoLib animation features are not identical. ashfox converts
portable motion where it can and reports target-only events that it omits. A
feature blocks export only when it cannot be lowered safely.

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
do not have a direct glTF equivalent. GLB and glTF artifacts omit those events
and disclose each omission in the export receipt; the source events stay in the
project.

## Delivery choices

- Embedded GLB is one finished 3D asset.
- Java block, GeckoLib 5, and Bedrock require several target files, delivered
  as one ZIP.
- glTF normally uses several related resources, delivered as one ZIP.

## Before exporting

Ask the agent to play every required animation, inspect texture assignment and
pixel scale, confirm the configured target, and resolve every blocking finding.
Target resource identifiers and export options are derived automatically. The
agent delivers only after every revision-bound visual review for the configured
profile is accepted. A successful delivery returns the converted and omitted
receipt alongside the artifact metadata.
