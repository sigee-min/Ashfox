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
compose a neutral structural module graph with focused specialists, inspect the
project, make changes, review the viewport, and prepare files. When the agent
asks what you want to create, answer naturally. Paste the instruction once per
working session.

## Describe your first asset

Include the subject, visual style, important features, and motion in one
request. Choose the delivery adapter later in Export.

```text
Create a Minecraft-style clockwork hound using the attached
front and side references. Preserve its low horizontal trunk, four grounded
legs, sensor head, and exposed shoulder drives. Use a restrained iron-green
and brass palette, plus idle and walk loops.
```

The compiler binds canonical motion to clip roles. Name every additional clip
you expect. A later static export may omit motion from its artifact, but it
never changes the canonical project.

The current composable authority covers creatures, figures, props, vehicles,
and other assets through neutral `core`, `axis`, `articulated`, `span`,
`focal-frame`, and `accent` modules. Choose `essential` only when you explicitly
want an intentionally distilled icon, mascot, chibi subject, or small game
piece. Choose `hero` for reference fidelity, mature proportions, flagship
detail, or whenever the request is ambiguous. The selected track governs the
whole asset; face requirements apply only when a full face is declared.

## Watch the result

The agent keeps the live viewport visible while it works. Ask it to inspect the
compiled result, review frames, and activity receipts whenever a result needs
closer review. Correct a visible problem with a short semantic follow-up; the
compiler, not the agent, owns transforms, pivots, and geometry.

## Deliver the finished asset

Ask the agent to finish every required viewport review. Then open **Export**,
choose the target adapter and any Minecraft-only options, and create the
artifact. The export result verifies its name, format, byte length, content
hash, and target-specific adaptations without changing the project.

Next: [Create and refine assets](authoring-and-review.md).
