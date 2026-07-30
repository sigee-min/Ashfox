# Save, Open, Export, and Capture

Tell the agent what artifact you need. It operates the workbench, waits for the
matching file operation to finish, activates the prepared artifact, and reports
the verified result.

## Create a project with the right settings

Include the project settings in the first request:

- **Name** — the human-readable project name;
- **Format** — GeckoLib 5, Bedrock, GLB, or glTF;
- **Namespace** — required for Minecraft formats;
- **Model path** — the export-safe asset name and path.

```text
Create a GeckoLib 5 project named Ember Stag.
Use namespace wildwood and model path creatures/ember_stag.
```

ashfox grows the generated atlas as needed while keeping one square texel per
model unit, then validates target-specific settings before export.

## Save the editable project

```text
Save the current editable project as an .ashfox file.
Deliver it to artifacts/ and verify the final filename and size.
```

The `.ashfox` file contains the project structure and required texture data.
Keep it when future editing is expected.

## Continue from an existing project

```text
Load my .ashfox project, inspect its current revision and target, and summarize
the model before making any changes.
```

The agent starts the open operation. Browser security may ask you to select the
local file; the agent resumes after the selection and confirms the loaded
project revision.

## Export a finished asset

```text
Validate the current project for its configured target.
Fix blocking findings, export it, deliver the artifact to artifacts/, and
verify the final filename, extension, and size.
```

GeckoLib 5, Bedrock, and glTF use ZIP when the target needs several related
files. GLB can contain geometry, animation, and textures in one binary.

See [Choose an export format](choose-a-format.md) for the exact result of each
option.

## Capture a GIF

Ask for either the build process or a selected animation:

```text
Capture the build process at 10fps with the full asset framed clearly.
Deliver the GIF to artifacts/ and verify the result.
```

```text
Capture the selected idle animation at 10fps in Studio lighting.
Deliver the GIF to artifacts/ and verify the result.
```

Capture uses the requested camera and environment and does not modify the
project.

## Verify delivery

The agent should report an artifact only after the workbench marks the same
operation as succeeded and the file exists at the final location.

Expected extensions:

- editable source: `.ashfox`;
- multi-file target: `.zip`;
- embedded 3D asset: `.glb`;
- capture: `.gif`.
