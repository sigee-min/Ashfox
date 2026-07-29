# Single-Agent Quality per Token

Status: **Accepted research direction**

Reviewed: 2026-07-28

## Conclusion

For one Codex agent, Ashfox should optimize the representation and tools before
adding more reasoning loops.

The practical high-quality path is:

```text
compact current context
→ high-leverage deterministic batch
→ local correctness checks
→ one relevant visual observation
→ one focused correction when necessary
→ target validation and export
```

Quality comes primarily from:

1. commands that express meaningful 3D operations instead of field edits;
2. a canonical editable document with stable IDs;
3. target constraints applied before authoring;
4. visual feedback only at uncertain decisions;
5. preserving the agent's attention for creative judgment.

## Research evidence

OpenAI's current Codex guidance recommends providing the goal, relevant
context, constraints, and completion condition, keeping durable guidance
short, and letting Codex run and verify the relevant checks. The Browser guide
also recommends small, reviewable browser tasks followed by another rendered
review. These principles support a compact project projection and explicit
completion gate rather than a long operating manual.

[ShapeAssembly](https://arxiv.org/abs/2009.08026) demonstrates that
hierarchical, parameterized shape programs produce editable structures and
allow parameter changes while preserving part attachments.

[CAD-Recode](https://arxiv.org/abs/2412.14042) represents CAD construction as
executable Python and shows that an off-the-shelf language model can understand
and edit the resulting program. This supports giving Codex composable
operations rather than raw vertex or document dumps.

[Code as Policies](https://arxiv.org/abs/2209.07753) shows that code-oriented
language models can compose precise spatial and geometric API primitives into
larger actions.

[Proc3D](https://arxiv.org/abs/2601.12234) reports that a compact procedural
graph is 4–10 times smaller than its compared code representations and enables
local edits far faster than full regeneration. Its benchmark and cube-heavy
training data do not directly prove Ashfox quality, but they reinforce the
value of compact parameterized editing.

[LLMCompiler](https://arxiv.org/abs/2312.04511) reports lower cost and latency
than sequential ReAct-style tool calls on its function-calling benchmarks.
One fused canonical batch carries the relevant benefit into Ashfox.

[Self-Refine](https://arxiv.org/abs/2303.17651) shows that iterative
self-feedback can improve results. Every iteration also adds another model
round trip. Ashfox should therefore use at most one correction driven by real
rendered evidence.

## Core inference

The existing `ProjectDocument` remains the editable result. A canonical command
batch acts as the compact temporary program, and deterministic commands expand
it into document entities. This retains one project authority while making
Codex output shorter and more reliable.

## High-leverage tools

The quality ceiling depends on the operations available to Codex. The following
commands remove repetitive arithmetic and preserve relationships by
construction.

### Shape

- create many primitives with shared defaults;
- transform many entities;
- mirror with stable source-to-result mapping;
- linear, radial, and path repeat;
- align and distribute;
- attach and reparent while preserving world transform;
- set pivots from bounds or joints;
- create a bone chain from ordered anchors.

### Texture and UV

- assign materials or textures by semantic role;
- box-project and fit UVs;
- pack bounded UV islands;
- apply a compact palette;
- shade faces from one light direction;
- apply seeded mask, noise, or dither;
- recolor a selected material role without repainting pixels individually.

### Animation

- set many keys in one command;
- copy or mirror channels;
- phase-shift repeated limbs;
- close a loop deterministically;
- scale timing and amplitude;
- apply one interpolation policy to selected channels.

### Delivery

- query target capabilities;
- validate the active target;
- bake only explicitly required target differences;
- export through the current deterministic compiler.

These are canonical product tools used by both React and Codex.

## Single-agent operating policy

The user request is the creative brief. Ashfox should not ask Codex to rewrite
it into another stored format.

Codex receives only:

- requested outcome;
- current target;
- current selection and counts;
- the deterministic tools valid in that context;
- one reference image or artifact when supplied;
- the completion condition.

The agent selects a tool, requests its schema only if unknown, and emits one
batch.

### Adaptive depth

| Work | Model interaction |
| --- | --- |
| Exact numeric or structural edit | inspect → run |
| Visual geometry or texture edit | inspect → run → observe → optional correction |
| Full asset | construct → observe → finish details/material/motion → final target check |

A new model step runs only when new information could change the next command.

## Visual observation

One visual observation must answer one question:

- shape: does the silhouette and proportion match the request?
- texture: is the material separation readable at the intended distance?
- animation: is the decisive pose readable at the selected time?

Ashfox supplies a deterministic camera, neutral lighting, target sampling, and
the currently affected selection. Codex uses one relevant view and expands the
review only when the user requests it.

A final screenshot is unnecessary when the operation is numeric and the local
checks fully determine correctness.

## Stop rule

Stop when:

1. the active target is locally valid;
2. the requested shape, material, or motion is visible;
3. the current observation exposes no specific defect worth another command.

Codex continues only when it can name a concrete correction.

## Token policy

- send bounded project inspection and the latest relevant receipt;
- return tools relevant to the current context;
- load the selected command schema when needed;
- batch independent and repeated operations;
- return revision, affected IDs, and one error path;
- keep images in the visual channel;
- return concise operation results;
- preserve session constants in the browser;
- observe only after visual uncertainty.

Target payload limits remain:

| Payload | Limit |
| --- | ---: |
| Default inspection | 2 KB |
| Requested detail or schema | 4 KB |
| Run result | 1 KB |
| Visual observation | zero or one per uncertain stage |

## Current repository shape

Ashfox has:

- a typed `ProjectDocument`;
- stable entity IDs;
- target-aware validation;
- Bedrock, GeckoLib 5, glTF, GLB, and Java exporters;
- revision history, receipts, local persistence, and a live Three.js viewport;
- one executable command registry and atomic batch reducer;
- multi-entity geometry, hierarchy, UV, deterministic texture, and animation
  operators;
- bounded Agent Command Port inspection and execution;
- visual review, Activity receipts, and Undo.

## Evaluation

Use the same Codex model and user request for both paths:

- baseline: field-level UI or commands;
- proposed: high-leverage commands with bounded inspection;
- proposed plus one visual correction.

Test a simple prop, symmetric creature, textured Minecraft asset, animated
entity, and target conversion. Record:

- input and output tokens;
- model-involved tool round trips;
- screenshots;
- elapsed time;
- target validation and consumer import;
- blind creator preference;
- whether later edits preserve prior intent.

Choose the Pareto result: lower tokens with equal or better creator preference
and equal target validity.

## Product decision

The recommended Ashfox strategy is:

```text
one strong Codex agent
+ compact context
+ powerful deterministic operations
+ one live viewport
+ at most one evidence-driven correction
```

## Sources

- [OpenAI Codex best practices](https://learn.chatgpt.com/guides/best-practices)
- [OpenAI prompting guidance](https://learn.chatgpt.com/docs/prompting)
- [OpenAI Browser guidance](https://learn.chatgpt.com/docs/browser)
- [ShapeAssembly](https://arxiv.org/abs/2009.08026)
- [CAD-Recode](https://arxiv.org/abs/2412.14042)
- [Code as Policies](https://arxiv.org/abs/2209.07753)
- [Proc3D](https://arxiv.org/abs/2601.12234)
- [LLMCompiler](https://arxiv.org/abs/2312.04511)
- [Self-Refine](https://arxiv.org/abs/2303.17651)
