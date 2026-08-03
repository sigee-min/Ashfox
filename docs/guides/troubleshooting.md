# Troubleshooting

Describe the visible symptom to the agent and ask it to inspect the active
project revision before changing anything.

## The agent cannot start ashfox

- Confirm that the agent can control an in-app or connected browser.
- Paste the manifest instruction from [Get started](ai-agent-quick-start.md).
- Ask the agent to report whether it reached the page, manifest, inspect call,
  or project revision.

An agent without browser control cannot use the automated workbench workflow.

## Nothing happens after the model request

- Confirm that the agent completed setup and reported the current revision.
- Ask it to inspect the project and continue from that revision.
- Include a concrete subject and target format.
- Keep the request focused on one asset.

## A texture is missing or stretched

Ask the agent to:

1. render the asset in Studio lighting;
2. identify untextured faces and their material base colors;
3. confirm generated bounds are aligned to the fixed iconic lattice;
4. confirm the automatically derived atlas uses identical square-pixel size
   on every face;
5. validate the texture paths before exporting.

For ZIP exports, preserve the generated texture paths and filenames.

## Small details disappear

Name the view and desired result:

```text
The eyes disappear in the three-quarter view.
Move them slightly higher and outward without changing the head silhouette.
```

Move or resize the eye's single surface feature on the existing volumetric
face host, or change its material role. Keep it on an exposed outer face and
use the deterministic face template instead of socket, pupil, highlight, mask,
billboard, or overlay cubes. Check the compiled rest pose, not only the part
recipe: the focal glyph must remain visible and contrast with its host. Move
or remove any tooth, brow, or ornament that covers it.

## Feet or toes point backward

Ask the agent to read the project's declared forward direction, then render
side and top views. It should trace each planted limb from shoulder or hip to
knee or elbow, ankle or wrist, foot, and toe. Ordinary toes and claws must
continue forward. A rear-facing dewclaw or species-specific exception must be
explicitly requested and visually intentional. Mirror left to right only
across the body axis; never mirror across the forward axis.

## An animation does not play correctly

Ask the agent to inspect the clip duration, channels, first frame, strongest
pose, and loop boundary. It should check each target bone and render the motion
before applying a correction.

## Export is blocked

Ask the agent to read the blocking validation finding and inspect the relevant
entity or target setting. Typical fixes include:

- removing geometry the target cannot represent;
- restoring the affected part's generated material;
- rewriting unsupported motion through the current animation command;
- removing target-specific events that the selected format cannot represent.

Warnings can be reviewed, but blocking findings must be fixed.

## A file did not reach the requested folder

Ask the agent to report the last completed boundary: artifact preparation,
download activation, workspace transfer, or file verification. It must retry
from the incomplete boundary and report only a file that exists.

Confirm the expected extension: `.zip` or `.glb`.

## Recover work

Ask the agent to inspect the active browser-local revision and continue from its
first blocker. If the problem remains reproducible, report it on
[GitHub](https://github.com/sigee-min/ashfox/issues) with the browser name,
target format, and shortest reproduction steps.
