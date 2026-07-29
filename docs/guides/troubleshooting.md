# Troubleshooting

Start with the visible symptom. Keep the current `.ashfox` project until the
problem is resolved.

## The agent cannot open ashfox

- Confirm that the agent can control an in-app or connected browser.
- Open [ashfox Workbench](https://ashfox.io/workbench/) yourself, then choose **Copy prompt** and
  paste it into the agent.
- Keep the ashfox tab open while the agent works.

If the agent has no browser access at all, you can still use the visible ashfox
controls manually, but automated modeling requires a connected browser.

## Nothing happens after I describe the asset

- Confirm that the agent said ashfox was ready before sending the model request.
- Ask it to inspect the current project and continue from the visible revision.
- Include a concrete subject and target format.
- Keep the request focused on one asset.

## The file picker was closed

Closing **Open project file** without choosing a file is a normal cancellation.
The current project should remain unchanged and the controls should be ready
immediately. Choose **Open project file** again when you are ready.

## A texture is missing or stretched

1. Check the asset in Studio lighting.
2. Ask the agent to identify untextured faces and the texture assigned to them.
3. Regenerate or repack the UV layout with one consistent pixel density.
4. Confirm that the texture is visible before exporting.
5. For ZIP exports, keep the generated texture path and filename unchanged.

## Small details disappear

Review the asset at the distance where it will be used. Ask for a correction
that names both the view and the desired result:

```text
The eyes disappear in the three-quarter view.
Move them slightly higher and outward without changing the head silhouette.
```

Increasing contrast or moving a detail is usually more effective than adding
more geometry.

## An animation does not play correctly

- Select the intended clip in **Animate**.
- Confirm that the clip has a duration and channels.
- Step through the first frame, strongest pose, and last frame.
- Check that each channel targets the intended bone.
- Ask the agent to close the loop if the final pose jumps back to the first.

## Export is blocked

Read the blocking validation message before trying again. Typical fixes include:

- removing geometry the target cannot represent;
- assigning missing textures;
- giving Minecraft bones and clips unique names;
- replacing unsupported interpolation or Minecraft-only events;
- setting a valid namespace and model path.

Warnings can be reviewed, but blocking findings must be fixed.

## A download did not reach the expected folder

The browser controls download permissions and destinations. Download the
prepared artifact normally, then move it into the project folder if direct
workspace delivery is unavailable.

Confirm the expected extension: `.ashfox`, `.zip`, `.glb`, or `.gif`.

## A GIF was not saved

Wait until capture finishes before downloading. If capture was cancelled, start
it again. Keep the tab visible and avoid changing the viewport while frames are
being recorded.

## I need to recover work

Reopen the newest `.ashfox` file. Browser-local state may preserve the current
project, but the downloaded project file is the safest long-term copy.

If a problem is reproducible after reopening the project, report it on
[GitHub](https://github.com/sigee-min/ashfox/issues) with the browser name,
target format, and the shortest steps that reproduce it.
