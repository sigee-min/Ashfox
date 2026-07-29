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

1. Open [ashfox Workbench](https://ashfox.io/workbench/).
2. Choose **Copy prompt** in the header.
3. Paste the copied prompt into your AI agent.
4. Wait until the agent says ashfox is ready.

You can also copy the same setup prompt here:

```text
Open https://ashfox.io/workbench/ in your in-app browser. If that is unavailable, use a
browser you can connect to and control. Read
https://ashfox.io/workbench/agent-manifest.json and use it as the single authority for
creating, editing, reviewing, saving, and exporting ashfox projects. Inspect
the current project and the relevant command schemas, then tell me ashfox is
ready for my model request. Do not change the project until I send that request.
```

The copied prompt teaches the agent how to inspect the current project, make
changes, review the viewport, and prepare files. You only need to paste it once
per working session.

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

ashfox shows each committed change in the live viewport.

- Open **Scene** to inspect the hierarchy.
- Open **Inspect** to check exact transforms and pivots.
- Open **Animate** to play or step through a clip.
- Open **Activity** to review recent changes.
- Choose **Undo** to reverse the last complete change.

You do not need to approve every normal modeling operation. Review the rendered
result and correct visible problems with a short follow-up request.

## Save before you leave

Choose **Save project** to download a self-contained `.ashfox` file. Reopen that
file later to continue with its models, textures, rig, animation, and activity
history intact.

Next: [Create and refine assets](authoring-and-review.md).
