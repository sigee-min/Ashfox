# AI IDE Quick Start

Ashfox is an AI-native low-poly workbench for consistent modeling, texturing,
and animation. The shortest workflow starts with one prompt in your AI IDE.

## 1. Paste this prompt

```text
Open https://ashfox.io in the in-app browser. Create a new Ashfox project and
build a highly detailed low-poly truck with consistent modeling, texturing,
and animation. Review the result in the live viewport.
```

The AI IDE opens Ashfox, discovers `/agent-manifest.json`, and operates the
single `window.ashfox` command port from the normal product surface.

## 2. Watch the complete asset form

Ashfox renders every committed modeling, texture, UV, and animation change in
the live viewport. Related edits apply as one validated command batch.

Invalid payloads, stale revisions, cancellation, duplicate delivery, and
exceptions terminate without leaving the workbench in a working state.

## 3. Review and refine

- Use the viewport to check silhouette, proportions, texture density, and
  motion.
- Use Activity to inspect the committed receipt.
- Use Undo to reverse the complete batch.

Give one short follow-up prompt when a visible result needs correction. Name
the problem and the intended result.

## 4. Save or export

Save preserves the editable project as `.ashfox`. Export produces the selected
Bedrock, GeckoLib 5, glTF, or GLB artifact. Capture produces a 10fps
build-process or animation GIF.

Next: [Authoring and review](authoring-and-review.md) or
[Save and export](save-and-export.md).
