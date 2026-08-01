# ashfox gallery demos

Each child folder is one self-contained, editable gallery demo. The site build
discovers `demo.json` files automatically, validates every referenced file, and
publishes the folder at `/demos/<id>/`.

```text
examples/gallery/<id>/
├── demo.json          # name, category, tags, order, metrics, media map
├── project.ashfox     # canonical editable source opened by the card
├── poster.jpg
├── build.gif
├── build.mp4          # required only when featured=true
├── animation.gif
└── animation.mp4      # optional
```

## Add a demo

1. Copy an existing demo folder and rename it to a lowercase slug.
2. Replace `project.ashfox`, `poster.jpg`, and the build/animation media.
3. Update `demo.json`; its `id` must match the folder name and its `order` must
   be unique.
4. Run `npm run test:site`. The build fails on missing files, duplicate ids or
   orders, invalid paths, broken GIFs, or an invalid `.ashfox` archive.

The workbench link is derived automatically from `project.ashfox`. New demos do
not require edits to the site catalog or the TypeScript demo registry.

The three original fixtures can be regenerated from their current canonical
TypeScript definitions with `npm run gallery:projects`.
