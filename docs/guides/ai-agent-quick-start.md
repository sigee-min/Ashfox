# Get Started

Use ashfox with Codex desktop app, Cursor, or another AI agent that can open
and control a browser. The AI authors, diagnoses, decides, compiles, and reviews
one Intent Program as one canonical asset. The workbench is where you observe
that process and deliver the result.

## Before you begin

Decide what the asset should mean:

1. the subject and visual style;
2. what faces forward and whether it is symmetric;
3. whether it contacts the ground through feet, a base, or wheels, or declares
   `support none`, and which declared modules own any contacts;
4. the identity details that must survive compilation, such as a full face or
   a pair of wings.

Choose an export adapter later. It does not affect the source or the canonical
asset.

## Connect your agent

1. Create a project in the workbench or open an existing `.ashfox` Intent
   Program source. The workbench compiles it before showing the asset.
2. Verify that the agent can control an in-app or connected browser.
3. Copy this instruction into the agent's external chat.
4. Wait until it asks what you want to create.

~~~text
Fetch and follow https://ashfox.io/workbench/agent-manifest.json using a direct HTTP request such as curl.
~~~

The manifest gives the agent two narrow asset-writing capabilities: stage one
complete Intent Program and run the exact compile operation returned by the
current workflow inspection. The agent decides whether to revise or compile;
you only observe its progress and result.

Keep the creation conversation in the agent's chat. The workbench does not
contain a second authoring surface.

## Describe your first asset

Include the subject, visual style, important structural relationships, and any
identity details in one request.

~~~text
Create a clockwork hound with a low horizontal trunk, four grounded legs, a
sensor head, exposed shoulder drives, and a restrained iron-green and brass
palette. It should read clearly from the front and three-quarter views.
~~~

The agent turns that request into a compact program. A program separates
topology, attachment, morphology, support, and animation with declarations such
as `limb legs paired parent torso anchor sides growth down lane center`,
`support feet contacts legs`, `full parent head`, and `idle breathe` in their
respective owner blocks.
It never uses lattice positions, mesh edits, texture coordinates, or animation
keyframes.

## Watch the autonomous build

After staging a valid program, the agent inspects the bound evidence and
decides whether to revise or compile. The viewport may automatically show a
temporary AI preview during this short interval. That preview is not an
editable project. The agent remains responsible for the decision. A successful
compile atomically replaces the canonical asset; a failed attempt leaves the
previous canonical asset intact while the agent diagnoses and revises it.

Use the camera presets, orbit view, environment, and motion playback to inspect
what ashfox is showing. If you notice a problem, describe the visible
relationship in chat. You never need to read or edit the Intent Program.

## Observe and request changes

Observe the compiled result in the viewport. If it needs to change, describe
the visible relationship that is wrong:

~~~text
Keep the same hound, but make the rear stance wider and add a mirrored pair of upward fins
behind the shoulder drives.
~~~

The agent submits and evaluates a replacement program, then compiles it when
its checks pass. The compiler owns every derived transform, texture placement,
hierarchy, and animation synthesized from the declared idle mode.

## Deliver the finished asset

The status rail tells you whether the AI is preparing, revising, or reviewing
the asset. When it reaches **Ready to export**, use **Download .ashfox** to
save its source,
**Export delivery files**, or **Capture**. Java block, GeckoLib 5, Bedrock,
GLB, and glTF remain delivery choices; Minecraft adapters ask for their game
version, namespace, and model path in that export flow only. The export receipt
reports target-specific conversions or omissions without changing the
canonical project.

Next: [Create and refine assets](authoring-and-review.md).
