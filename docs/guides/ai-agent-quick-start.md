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
2. Copy the setup prompt below into the agent.
3. Wait until the agent says ashfox is ready.

```text
Open https://ashfox.io/workbench/ in your in-app browser. If that is
unavailable, use a browser you can connect to and control. Read
https://ashfox.io/workbench/agent-manifest.json and use it as the single
authority for creating, editing, reviewing, saving, and exporting ashfox
projects. Inspect the current project and the relevant command schemas, then
tell me ashfox is ready for my model request. Do not change the project until I
send that request.
```

The agent opens the page, inspects the current project, and learns how to make
changes, review the viewport, and prepare files. Paste it once per working
session.

## Describe your first asset

Include the subject, visual style, export format, important features, and
motion in one request.

```text
Create a Minecraft-style arcane field tractor for GeckoLib 5.
Give it a readable cab, large rear wheels, an articulated drivetrain,
consistent 32px textures, and a slow mechanical idle animation.
```

For a static prop, say that no animation is needed. For a character, name the
clips you expect, such as `idle`, `walk`, or `attack`.

## Watch the result

The agent keeps the live viewport visible while it works. Ask it to inspect the
scene hierarchy, exact transforms, pivots, animation clips, and activity
receipts whenever a result needs closer review. Normal modeling commands apply
without individual approval; correct a visible problem with a short follow-up
request.

## Save before you leave

Ask the agent to save a self-contained `.ashfox` file and verify its final
location. Give that file to the agent later to continue with its models,
textures, rig, animation, and activity history intact.

Next: [Create and refine assets](authoring-and-review.md).
