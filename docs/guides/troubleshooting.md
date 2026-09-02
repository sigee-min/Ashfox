# Troubleshooting

## A workspace change is rejected

- Re-inspect the current workspace hash. `workspace.apply` rejects a stale
  compare-and-swap guard.
- Treat the first diagnostic's package, path, and span as the owning source
  location; do not patch the canonical scene.
- Make the package manifest list every entry/module and make the lock match the
  complete source bytes and compiler fingerprint.
- Use explicit imports. Host paths, URLs, wildcard imports, implicit index
  files, mutable versions, import cycles, and entry-to-entry imports reject.
- Ensure every declared module is reachable from at least one declared entry.
  Whole-workspace commit does not retain orphan source.
- Compile every declared entry. One invalid entry rejects the entire staged
  change even if another selected entry would build.

## A symbol or binding is rejected

- Export a declaration before importing it from another module.
- Use the required `alias.Name` nominal reference; matching strings and shapes
  are not compatibility.
- Make each skeleton implement its exact rig and bind every required joint.
- Bind every component parameter and rig/surface/socket port exactly once.
- Connect sockets only when contracts, handed frames, and capacities are
  compatible.
- Apply a motion only to the nominal rig for which it was declared.

## Texture or geometry is rejected

- Match every consumed primitive to the surface contract's chart layout and
  exact dimensions.
- Keep a chart and its concrete texture under the same surface contract.
- Use lexical bones and explicit rig/socket binding; arbitrary scene-parent
  escape hatches are not source authority.
- Keep plane geometry for genuine zero-thickness features. Rebuild masses and
  contacts as connected volume instead of coplanar overlays.
- Fix palette, chart, coverage, stamp, pattern, or grain diagnostics in the
  owning surface module. There is no automatic UV or paint repair.

## The product is valid but looks wrong

This is a visual review issue. Inspect gameplay/native, front, side, top, and
perspective views, then motion cycles. Revise the owning rig, component,
surface, motion, or asset assembly and submit a new complete workspace change.

Mechanical success proves deterministic closure, typing, lowering, and
canonical validity. It does not certify silhouette, proportion, focal detail,
palette quality, or taste.

## Export is rejected

Run the on-demand target preflight and read its target-specific findings.
Export request options are transient and cannot change the workspace. A
stale/swapped build identity, unsupported target feature, or unapproved data
loss must reject rather than silently flatten the artifact.

## Recover work

Reopen the saved `.ashfoxworkspace`. The reader validates canonical JSON and
the exact lock, then recompiles the selected entry. Browser caches, derived
documents, previews, replay frames, reviews, and export receipts are
discardable products, not recovery authority.
