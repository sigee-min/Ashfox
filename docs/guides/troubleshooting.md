# Troubleshooting

ashfox keeps the AI-staged Intent Program and the compiled canonical asset
separate. Start with the stage that needs attention: prompt, preparation,
compilation, AI review, export, capture, or download.

## The agent cannot start ashfox

- Verify that the agent can control an in-app or connected browser.
- Paste the manifest instruction from [Get started](ai-agent-quick-start.md).
- Ask the agent to report whether it reached the workbench and can read its
  current workflow state.

An agent without browser control cannot use the workbench workflow.

## The AI does not begin the build

Create a named project first, then ask for one complete asset description. The
agent must lint and submit exactly one complete Intent Program at a time. Ask
the agent to inspect the current workflow blocker. It should use every
diagnostic and source span to repair the program, not ask you to edit it.

## The AI preview remains visible

The preview is temporary feedback while the agent evaluates a staged program.
It is neither the canonical asset nor a request for human action. Ask the agent
to inspect the current workflow state. It must decide whether to repair the
program or run the exact compilation operation supplied by that inspection.

## Compilation is blocked

Compilation is atomic. The existing canonical asset remains unchanged when the
new source fails. Ask the agent to consume all reported source spans, revise
the declarations that caused the conflict, and evaluate the complete program
again.

Common semantic corrections include:

- use `support feet contacts <limb>` only for a bilaterally standing asset;
- give every relationship an explicit topology `parent`, spatial `anchor`,
  morphology `growth`, and collision-free `lane`;
- use a paired surface with `anchor sides`, and state a single surface’s anchor
  and growth explicitly;
- give a full face its named host, centered eyes, a nose state, and a mouth
  state;
- keep `parent` independent from `anchor` and `growth`; never encode anatomy or
  placement in an ID;
- give hero track exactly one focal stage: a full face or `focal <id> parent
  <body-id>`;
- declare `idle still`, `idle breathe`, or `idle scan` inside `animation`;
- express a forward-facing requirement through `orientation forward`,
  not a coordinate or rotation.

## A compiled detail is wrong

Describe the observed relationship and the intended relationship in one short
request. For example:

~~~text
The eyes are too low relative to the face. Keep them centered and make the
facial read clearer from the three-quarter view.
~~~

or:

~~~text
Keep the same body, but make both rear feet point forward and widen the rear
stance.
~~~

The agent should submit and evaluate a revised Intent Program, then compile it
when it is valid. Observe the new result in the viewport and continue the
conversation if it still misses the intended relationship. This keeps one
source of truth for the asset.

## Texture readability is poor

Check the compiled asset in the relevant views and lighting. State the desired
palette or focal relationship, such as “use the ocean palette with clearer eye
contrast” or “keep the panel readable at a distance.” ashfox derives the
pixel-surface shading, atlas placement, and focal motif from the revised source.

## Export is blocked

Open **Export unavailable** and read the creation or review blocker. After the
rail reaches **Ready to export**, open **Export delivery files** and read any
adapter-specific finding. Pick the required game
version, namespace, and model path only when the selected Minecraft adapter
asks for them. If an adapter cannot represent a canonical feature safely,
choose a compatible adapter or describe the necessary asset revision in chat.
The agent owns recompilation. The adapter never changes the canonical project
while it evaluates delivery.

## A file did not reach the requested folder

Ask the agent to report the last completed boundary: artifact preparation,
download activation, workspace transfer, or file verification. Retry from that
boundary and report success only for a file that exists. Verify the expected
extension: .zip for multi-file artifacts or .glb for an embedded 3D asset.

## Recover work

Reopen the browser-local project and inspect its workflow state. The compiled
program and its canonical result remain available unless the agent completes a
new atomic compilation. For a reproducible product defect, report the browser
name, the Intent Program, the selected export adapter if relevant, and the
shortest reproduction at [GitHub](https://github.com/sigee-min/ashfox/issues).
