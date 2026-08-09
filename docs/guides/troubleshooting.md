# Troubleshooting

ashfox keeps the confirmed Intent Program and the compiled canonical asset
separate. Start with the stage that failed: proposal, confirmation,
compilation, review, export, or download.

## The agent cannot start ashfox

- Confirm that the agent can control an in-app or connected browser.
- Paste the manifest instruction from [Get started](ai-agent-quick-start.md).
- Ask the agent to report whether it reached the workbench and can read its
  current workflow state.

An agent without browser control cannot use the workbench workflow.

## No proposal appears

Create a named project first, then ask for one complete asset description. The
agent must submit exactly one Intent Program proposal and stop for your
confirmation. If the proposal is rejected, use the diagnostic’s line and
column to correct the source meaning, then submit a replacement program.

## The proposal is waiting

Waiting is expected. Read the complete program before confirmation: especially
the forward frame, symmetry, neutral support, face state, and supported
surfaces. Confirm it only when it describes the asset you intend. To change
it, ask for a replacement program rather than confirming an incorrect one.

## Compilation is blocked

Compilation is atomic. The existing canonical asset remains unchanged when the
new source fails. Read the reported source span, then revise the declaration
that caused the conflict.

Common semantic corrections include:

- use neutral feet only for a bilaterally standing asset;
- use a paired lateral surface for bilateral side surfaces;
- give a full face centered eyes, a nose state, and a mouth state;
- attach a body module or surface to an existing named body module;
- express a forward-facing requirement through the front-frame declaration,
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

The agent should submit a revised Intent Program. Review it, confirm it, and
review the new compiled result. This keeps one source of truth for the asset.

## Texture readability is poor

Check the compiled asset in the relevant views and lighting. State the desired
palette or focal relationship, such as “use the ocean palette with clearer eye
contrast” or “keep the panel readable at a distance.” ashfox derives the
pixel-surface shading, atlas placement, and focal motif from the revised source.

## Export is blocked

Open **Export** and read the adapter-specific finding. Pick the required game
version, namespace, and model path only when the selected Minecraft adapter
asks for them. If an adapter cannot represent a canonical feature safely,
choose a compatible adapter or revise the Intent Program and compile again.
The adapter never changes the canonical project while it evaluates delivery.

## A file did not reach the requested folder

Ask the agent to report the last completed boundary: artifact preparation,
download activation, workspace transfer, or file verification. Retry from that
boundary and report success only for a file that exists. Confirm the expected
extension: .zip for multi-file artifacts or .glb for an embedded 3D asset.

## Recover work

Reopen the browser-local project and inspect its workflow state. The confirmed
program and its canonical result remain available unless you replace them with
a newly confirmed compilation. For a reproducible product defect, report the
browser name, the Intent Program, the selected export adapter if relevant, and
the shortest reproduction at [GitHub](https://github.com/sigee-min/ashfox/issues).
