# Get Started

Use ashfox with Codex desktop app, Cursor, or another AI agent that can open
and control a browser. The workbench compiles one confirmed Intent Program into
one canonical asset.

## Before you begin

Decide what the asset should mean:

1. the subject and visual style;
2. what faces forward and whether it is symmetric;
3. whether it stands on feet, rests on a base, or is airborne;
4. the identity details that must survive compilation, such as a full face or
   a pair of wings.

Choose an export adapter later. It does not affect the source or the canonical
asset.

## Connect your agent

1. Confirm that the agent can control an in-app or connected browser.
2. Copy this instruction into the agent.
3. Wait until it asks what you want to create.

~~~text
Fetch and follow https://ashfox.io/workbench/agent-manifest.json using a direct HTTP request such as curl.
~~~

The manifest gives the agent one asset-writing capability: it can propose an
Intent Program. The workbench shows that proposal for your confirmation and
compiles it only after confirmation.

## Describe your first asset

Include the subject, visual style, important structural relationships, and any
identity details in one request.

~~~text
Create a clockwork hound with a low horizontal trunk, four grounded legs, a
sensor head, exposed shoulder drives, and a restrained iron-green and brass
palette. It should read clearly from the front and three-quarter views.
~~~

The agent turns that request into a compact program. A program uses semantic
declarations such as body limb legs pair from torso, rest neutral feet, and
surface fins pair fin from torso extends up; it never uses lattice positions,
mesh edits, texture coordinates, or animation keyframes.

## Confirm and compile

Read the complete proposal in the workbench. Check the project’s forward
direction, symmetry, rest support, face declaration, surface directions, and
palette before confirming. Confirming compiles the source atomically: either a
valid canonical asset replaces the prior canonical asset, or the workbench
shows a source-specific diagnostic and preserves the prior result.

## Review and revise

Review the compiled result in the viewport. If it needs to change, describe the
visible relationship that is wrong:

~~~text
Keep the same hound, but make the rear stance wider and add paired upward fins
behind the shoulder drives.
~~~

The agent submits a replacement program. Review and confirm it again; the
compiler owns every derived transform, texture placement, hierarchy, and idle
motion.

## Deliver the finished asset

After review, open **Export** and choose Java block, GeckoLib 5, Bedrock, GLB,
or glTF. Minecraft adapters ask for their game version, namespace, and model
path in that export flow only. The export receipt reports target-specific
conversions or omissions without changing the canonical project.

Next: [Create and refine assets](authoring-and-review.md).
