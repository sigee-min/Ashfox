# Get started

Ashfox persists one closed asset workspace. The workspace contains exact
`ashfox-model 1` source modules, package manifests, and an exact lock. The Web
Studio is an observation, review, and delivery surface; generated scene data is
not editable authority.

## Connect

1. Create or open a Workbench project.
2. Give the connected agent this instruction:

~~~text
Fetch and follow https://ashfox.io/workbench/agent-manifest.json using a direct HTTP request such as curl.
~~~

3. Describe the gameplay scale, forward direction, silhouette, rig, reusable
   parts, material groups, and motion.

The agent first inspects the active workspace summary. It reads exact bounded
source ranges only when needed, prepares one complete workspace change set,
and submits the sole mutation command, `workspace.apply`, with the current
workspace-hash compare-and-swap guard and an explicit selected entry.

The change is atomic. Every declared entry and module must parse, resolve, type
check, instantiate, and reach a canonical product. A stale hash, orphan module,
invalid lock, or failed entry leaves the existing workspace unchanged.

## Organize reuse

- Put shared nominal rig contracts, skeletons, and motions in a rig module.
- Put chart/material ABIs and concrete deterministic texture programs in
  surface modules.
- Put reusable lexical geometry behind typed component ports.
- Keep entry files small: import modules, choose a skeleton, bind components
  and surfaces, connect sockets, and select motions.

Open the checked-in
[`shared-creatures.ashfoxworkspace`](../../examples/shared-creatures.ashfoxworkspace)
to see two entries reusing one rig, motion, component, and surface library.

## Review and deliver

Review perspective, gameplay/native, front, side, and top views, then each
motion cycle. Mechanical validation proves deterministic correctness, not
visual quality. A rejection must lead to a new workspace source change; never
patch a rendered scene or canonical texture.

After review, Build replay reconstructs the current entry from empty scene to
finished product. Export then recompiles the exact selected entry, verifies its
workspace/closure/build/product lineage, and runs the chosen target validator.
