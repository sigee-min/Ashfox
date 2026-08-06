# Get Started

Use ashfox with Codex desktop app, Cursor, or another AI agent that can open and
control a browser. Blockbench is not required.

## Before you begin

Decide three things:

1. what you want to make;
2. where you want to use it;
3. whether it needs animation.

You can change details later, but choosing the export format before modeling
helps ashfox catch incompatible geometry or animation early.

## Connect your agent

1. Confirm that the agent can control an in-app or connected browser.
2. Copy the single manifest instruction below into the agent.
3. Wait until the agent asks what you want to create.

```text
Fetch and follow https://ashfox.io/workbench/agent-manifest.json using a direct HTTP request such as curl.
```

The manifest tells the agent how to open ashfox, record reference observations,
route the request through one archetype and focused specialists, inspect the project, make
changes, review the viewport, and prepare files. When the agent asks what you
want to create, answer naturally. Paste the instruction once per working
session.

## Describe your first asset

Include the subject, visual style, export format, important features, and
motion in one request.

```text
Create a Minecraft-style clockwork hound for GeckoLib 5 using the attached
front and side references. Preserve its low horizontal trunk, four grounded
legs, sensor head, and exposed shoulder drives. Use a restrained iron-green
and brass palette, plus idle and walk loops.
```

Animation-capable authority profiles bind selected motion specialists to
canonical clip roles. Name every additional clip you expect. Static export
targets do not create an empty ceremonial animation clip.

The current archetypes cover compact upright figures, arm-free stalkers,
quadrupeds, and compact functional constructs. Focused specialists can add one
grounded role, surface, silhouette, or motion contribution. The agent will
identify the selected authorities, evidence criteria, and claims before it
authors coordinates.

## Watch the result

The agent keeps the live viewport visible while it works. Ask it to inspect the
scene hierarchy, exact transforms, pivots, animation clips, and activity
receipts whenever a result needs closer review. Normal modeling commands apply
without individual approval; correct a visible problem with a short follow-up
request.

## Deliver the finished asset

Ask the agent to finish every required viewport review and deliver the current
target. It verifies the artifact name, format, byte length, and content hash
before transferring the prepared file.

Next: [Create and refine assets](authoring-and-review.md).
