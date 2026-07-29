# Save, Open, Export, and Capture

ashfox keeps the editable project separate from finished export files. Save the
project when you want to continue editing; export when you want to use the asset
elsewhere.

## Create a project with the right settings

Choose **New project**, then set:

- **Name** — the human-readable project name;
- **Format** — GeckoLib 5, Bedrock, GLB, or glTF;
- **Namespace** — required for Minecraft formats;
- **Model path** — the export-safe asset name and path;
- **Texture canvas** — 16, 32, 64, 128, or 256 pixels square.

Choose the smallest texture canvas that can preserve the required details.
Minecraft-style assets commonly begin at 16, 32, or 64 pixels.

## Save the editable project

Choose **Save project** to download one `.ashfox` file. It contains the project
structure and required texture data, so it is the file to keep for future
editing.

Each save creates a new download. Keep the newest file or use a clear filename
when your browser asks where to save it.

## Open an existing project

1. Choose **Open project file**.
2. Select a `.ashfox` file.
3. Wait for the viewport and project name to update.

Closing the file picker without selecting a file changes nothing. Your current
project remains open.

## Export a finished asset

1. Choose **Export**.
2. Confirm the format, namespace, and model path.
3. Start the export.
4. Fix any blocking validation message and export again.
5. Download the prepared file.

ashfox uses ZIP whenever a target needs several files. GLB can contain its
textures in one binary file.

See [Choose an export format](choose-a-format.md) for the exact result of each
option.

## Capture a GIF

Choose **Capture**, then select:

- **Build process** to replay how the asset was assembled;
- **Animation** to record the selected animation clip.

Both modes render at 10fps using the current camera and environment. Keep the
asset framed the way you want before starting. You can cancel while capture is
running, and capture never changes the project itself.

When capture finishes, download the prepared `.gif` file.

## Choose where a file is saved

Browser permissions decide whether a download can be written directly to a
chosen folder. If your agent cannot place the file in a workspace directory,
use the browser download and move the file afterward.

Always verify the final filename and extension:

- editable source: `.ashfox`;
- multi-file target: `.zip`;
- embedded 3D asset: `.glb`;
- capture: `.gif`.
