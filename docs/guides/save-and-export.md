# Save and Export

Ashfox prepares one browser artifact at a time. Project save, target export, and
GIF capture share the same terminal file-operation state and artifact handoff.

## Save the editable project

Choose **Save project** to create one self-contained `.ashfox` archive. The
archive preserves the canonical project document and required texture bytes so
it can be opened in Ashfox again.

The operation is complete only when its matching operation ID reaches
`succeeded`. Cancelling the picker ends as `cancelled`; it never leaves the UI
working.

## Choose an export target

| Target | Delivery |
| --- | --- |
| GeckoLib 5 | Geometry, animation, and textures in one ZIP |
| Bedrock | Geometry, animation, and textures in one ZIP |
| GLB | One embedded binary file when the selected profile is self-contained |
| glTF | JSON and external resources in one ZIP when more than one file is required |

Target validation runs before materialization. Blocking findings prevent an
invalid export; warnings remain visible for review.

## Capture a GIF

Choose **Build process** to replay semantic construction events or
**Animation** to sample the selected clip. Both modes:

- render at 10fps;
- reuse the current camera and environment;
- show progress and allow cancellation;
- leave project history unchanged;
- prepare one `.gif` artifact when complete.

## Verify delivery

1. Wait for `succeeded` with the same operation ID.
2. Activate the persistent artifact action.
3. Save or transfer the file to the intended location.
4. Verify that the file exists and report its actual path and format.

The web page prepares bytes for download. Only the browser or AI IDE host can
write them to a user-selected or workspace-relative path.
