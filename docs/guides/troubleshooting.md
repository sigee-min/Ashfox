# Troubleshooting

Describe the visible symptom to the agent and keep the latest `.ashfox` project
available until the issue is resolved.

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

## A file selection was cancelled

Tell the agent to begin the open operation again. Cancellation leaves the
current project unchanged and must return the file state to idle.

## A texture is missing or stretched

Ask the agent to:

1. render the asset in Studio lighting;
2. identify untextured faces and their material base colors;
3. check that effective cube dimensions are positive whole pixel units;
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

Increasing contrast or moving a detail is usually more effective than adding
more geometry.

## An animation does not play correctly

Ask the agent to inspect the clip duration, channels, first frame, strongest
pose, and loop boundary. It should check each target bone and render the motion
before applying a correction.

## Export is blocked

Ask the agent to read the blocking validation finding and inspect the relevant
entity or target setting. Typical fixes include:

- removing geometry the target cannot represent;
- assigning missing textures;
- giving Minecraft bones and clips unique names;
- replacing unsupported interpolation or Minecraft-only events;
- setting a valid namespace and model path.

Warnings can be reviewed, but blocking findings must be fixed.

## A file did not reach the requested folder

Ask the agent to report the last completed boundary: artifact preparation,
download activation, workspace transfer, or file verification. It must retry
from the incomplete boundary and report only a file that exists.

Confirm the expected extension: `.ashfox`, `.zip`, `.glb`, or `.gif`.

## A GIF was not saved

Ask the agent to inspect the capture operation ID and terminal state. A
cancelled or failed capture can be started again; a succeeded capture must use
the matching prepared artifact.

## Recover work

Give the newest `.ashfox` file to the agent and ask it to inspect the loaded
revision before editing. If the problem remains reproducible, report it on
[GitHub](https://github.com/sigee-min/ashfox/issues) with the browser name,
target format, and shortest reproduction steps.
