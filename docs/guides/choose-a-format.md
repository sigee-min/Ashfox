# Choose an Export Format

Choose the adapter used to deliver an already-compiled canonical asset.

| Format | Choose it when | Download |
| --- | --- | --- |
| Java block | A Java resource pack needs one static block model | Resource-pack ZIP with metadata, blockstate, model, and textures |
| GeckoLib 5 | A Minecraft Java mod uses GeckoLib 5 animated models | ZIP with geometry, animation, and textures |
| Bedrock | A Bedrock project needs geometry and actor animation assets | ZIP with geometry, animation, and textures |
| GLB | A game engine, 3D tool, or viewer should receive one portable file | One `.glb` with embedded geometry, animation, and textures |
| glTF | A 3D pipeline prefers editable JSON and separate resources | ZIP with `.gltf`, binary data, and textures |

Minecraft adapters show a **Game version** setting in the Export menu. It is
not saved in the project or given to the compiler. The workbench lists only
combinations its exporters test; it does not accept an arbitrary version string.

For Bedrock and GeckoLib, this is the tested consumer compatibility target.
Multiple supported game versions can intentionally share the same stable
geometry or animation schema; selecting a version does not invent a different
asset payload when the consumer contract is unchanged.

The selected format is an export-only choice, not a project setting or
authoring mode. Changing it cannot rewrite canonical geometry, textures,
hierarchy, clips, events, or the Intent Program. Export compiles a transient
copy and reports anything it converted or omitted from that artifact.

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

Review canonical animation, texture assignment, and pixel scale first. Then
choose the export adapter and resolve any adapter-specific finding in the
Export menu. Namespace, path, and version live only in that menu. A successful
export returns the converted and omitted receipt alongside artifact metadata.
