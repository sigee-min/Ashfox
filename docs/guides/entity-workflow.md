# Entity Workflow (GeckoLib-only)

Only GeckoLib is supported.

Recommended steps:
1) ensure_project with format=geckolib (optionally set uvPixelsPerBlock)
2) build bones/cubes with add_bone/add_cube
3) assign textures (assign_texture)
4) paint textures (paint_faces)
5) create animations (create_animation_clip + set_frame_pose)
6) add triggers (set_trigger_keyframes) if needed
7) optionally run preview/validate

Notes:
- Modeling is low-level only (add_bone/add_cube).
- UVs are managed internally; no manual UV tools or preflight steps are required.
- Cube add/scale triggers internal auto-UV; repaint with paint_faces if needed.
- Project UV density is controlled by ensure_project.uvPixelsPerBlock (default 16); reused projects infer a median.
- Animation poses are one frame per call; repeat set_frame_pose/set_trigger_keyframes to build timelines.
