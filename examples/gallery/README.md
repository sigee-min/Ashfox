# ashfox gallery demos

Each child folder is one self-contained, editable gallery demo. The site build
discovers `demo.json` files automatically, validates every referenced file, and
publishes the folder at `/demos/<id>/`.

```text
examples/gallery/<id>/
├── demo.json          # name, category, tags, order, metrics, media map
├── project.ashfox     # canonical editable source opened by the card
├── poster.png         # .jpg is also supported
├── animation.gif      # required card preview
├── animation.mp4      # optional alternate playback source
└── build.gif          # optional real authoring-session recording
```

## Add a demo

1. Copy an existing demo folder and rename it to a lowercase slug.
2. Create the project in the workbench, save its `.ashfox` file into the new
   folder, and replace the poster and animation media. Add build media only
   when it records the real authoring session. Author showcase models in
   meaningful committed passes so the recording visibly progresses from
   primary mass through silhouette, articulation, focal detail, materials, and
   motion. Never reconstruct a fake build after completion.
3. Update `demo.json`; its `id` must match the folder name and its `order` must
   be unique.
4. Run `npm run test:site`. The build fails on missing files, duplicate ids or
   orders, invalid paths, broken GIFs, or an invalid `.ashfox` archive.

The workbench link is derived automatically from `project.ashfox`. New demos do
not require edits to a site catalog or a TypeScript registry.

`project.ashfox` is the sole source of truth. Tests open the finished archive and
validate its schema, semantic anatomy, visible eyes, declared forward direction,
media references, and production export readiness. Tests never generate or
rewrite gallery projects, and there are no arbitrary part-count targets.
