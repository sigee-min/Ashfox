# Choose an Export Format

Choose the adapter used to deliver an already-materialized canonical asset.

| Format | Choose it when | Download |
| --- | --- | --- |
| Java block | A Java resource pack needs one static block model | Resource-pack ZIP with metadata, blockstate, model, and textures |
| GeckoLib 5 | A Minecraft Java mod uses GeckoLib 5 animated models | ZIP with geometry, animation, and textures |
| Bedrock | A Bedrock project needs geometry and actor animation assets | ZIP with geometry, animation, and textures |
| GLB | A game engine, 3D tool, or viewer should receive one portable file | One `.glb` with embedded geometry, animation, and textures |
| glTF | A 3D pipeline prefers editable JSON and separate resources | ZIP with `.gltf`, binary data, and textures |

Minecraft adapters show one read-only **Current target version** resolved from
the engine export registry. There is no project field, version selector,
fallback, or arbitrary version string. Each format has exactly one current
registry entry; changing the external compatibility target is a code-and-test
update, not an artifact request option. Bedrock/Gecko geometry and animation format
versions remain explicit external file contracts inside that current entry.

The current authority as of 2026-08-25 is:

| Target | Runtime authority | Serialized external contract |
| --- | --- | --- |
| Java block | Minecraft Java 26.2 | resource-pack format 88 |
| GeckoLib 5 | Minecraft Java 26.2; the target ID owns the GeckoLib 5 family | geometry 1.12.0, animation 1.8.0 |
| Bedrock | Minecraft Bedrock 26.45 | geometry 1.21.0, animation 1.8.0 |
| GLB / glTF | glTF 2.0 | asset version 2.0 |

These are deliberately different kinds of version. The current Java and
Bedrock runtime targets follow the official [Java 26.2 release](https://www.minecraft.net/en-us/article/minecraft-java-edition-26-2)
and [Bedrock 26.45 hotfix](https://feedback.minecraft.net/hc/en-us/articles/48149564061965-Minecraft-Bedrock-Edition-26-44-45-Hotfix-Changelog).
The Bedrock geometry value remains a real wire contract documented by
[Microsoft's geometry 1.21.0 schema](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/visualreference/geometry.v1.21.0?view=minecraft-bedrock-stable).
GeckoLib's [upstream release history](https://github.com/bernie-g/geckolib/releases)
uses patch versions, but those versions are not a geometry or animation field
and are therefore not copied into exported assets;
the `geckolib5` target ID owns the supported major family. Updating any target
requires replacing this one registry authority and its target decoders
atomically—never adding another selectable or fallback version.

The selected format is an export-only choice, not a project setting or
authoring mode. Changing it cannot rewrite canonical geometry, textures,
hierarchy, clips, events, or the workspace. Export adapts a transient
copy and reports anything it converted or omitted from that artifact.

## Java block

Use Java block for a static block that should drop into a Java resource-pack
layout. The ZIP contains `pack.mcmeta`, the blockstate, model JSON, and texture
files for the compiler's current Java target version.

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

Review canonical animation, texture assignment, and pixel scale first. Then
choose the export adapter and resolve any adapter-specific finding in the
Export menu. Namespace and path are request inputs; the target version comes
only from the current engine registry. A successful export returns the
converted and omitted receipt alongside artifact metadata.
