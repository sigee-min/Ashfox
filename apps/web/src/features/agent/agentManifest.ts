import { listAgentCommandDefinitions } from '@ashfox/engine-core';

import { agentCommandProtocol } from './agentCommandProtocol';
import { schemaHash } from './schemaHash';

const commands = listAgentCommandDefinitions().map((definition) => ({
  name: definition.name,
  purpose: definition.purpose,
  schemaHash: schemaHash(definition.inputSchema)
}));

export const agentManifest = {
  protocol: agentCommandProtocol.protocol,
  workbench: agentCommandProtocol.workbench,
  href: agentCommandProtocol.href,
  description:
    'Complete machine guide for the ashfox AI-agent-native low-poly workbench.',
  setup: {
    manifest:
      'Fetch this JSON with a direct HTTP request tool such as curl. Never navigate the controlled browser to the manifest.',
    browser:
      'Open the workbench in an in-app browser. If unavailable, use a browser the agent can connect to and control.',
    authority:
      'This manifest is the complete agent operating guide. Semantic model changes use the listed commands; visible controls remain available for human project settings, review, and file boundaries.',
    ready:
      'Connect the page API, inspect the empty or active project, then ask exactly: "What would you like to create?" Do not mutate before the user answers.'
  },
  pageApi: {
    global: 'ashfox',
    inspectMethod: 'inspect',
    runMethod: 'run',
    presentMethod: 'present',
    inspect: {
      current:
        'window.ashfox.inspect() returns revision, target, typed counts, and deterministic workflow guidance: current stage, first blocker with its fix, up to three existing command names, and visual reviews still required on this revision.',
      command:
        'window.ashfox.inspect({kind:"command",name:"<commands entry>"}) returns the canonical input schema.',
      catalog:
        'window.ashfox.inspect({kind:"catalog",limit:50}) returns a bounded page of part, texture, and clip IDs; pass nextCursor back as cursor until null.',
      parts:
        'window.ashfox.inspect({kind:"parts",ids:["<partId>"]}) returns up to 10 authorable project-space part specs without internal attachment coordinates, plus materials, compiled bone IDs, bounds, authored-to-canonical cell retention, derived parent contact, and six-view silhouette contribution.',
      entities:
        'Use kind entity, texture, or clip with at most 10 IDs. Oversized clip values return a bounded summary with truncated true.',
      activity:
        'window.ashfox.inspect({kind:"activity",limit:20}) returns bounded receipt summaries; pass nextCursor back as cursor until null.',
      validation:
        'Use kind target for structural validity, mechanical readiness, revision-bound workflow guidance, the mandatory semantic-review flag, and local texture-byte materialization; use kind finding with a path for one exact finding. Export performs the final SHA-256 byte check.'
    },
    run: {
      call:
        'await window.ashfox.run({batchId:"<unique>",baseProjectId:"<project.id>",baseRevision:"<current>",operations:[{name:"<command>",payload:{}}]})',
      atomicity:
        'A batch contains 1-64 agent commands. Compilation, texture derivation, structural validation, and target validation either commit together or leave the project unchanged.',
      idempotency:
        'For the connected page session and baseProjectId, the same batchId and content returns its completed result. Reusing that project-scoped batchId for different content is rejected.',
      concurrency:
        'Submit one batch at a time. Success returns a bounded receipt with entity counts and at most 16 IDs per effect; inspect the catalog or known IDs for detail. Success, rejection, no_change, stale revision, cancellation, and exception are terminal and restore connected status.'
    },
    present: {
      call:
        'await window.ashfox.present({kind:"view",mode:"frame",camera:"front",clipId:"<clip-or-null>",timeSeconds:0}); use mode cycle with a clip ID to observe one complete loop.',
      review:
        'The promise resolves from observed renderer state, not request echo. Each success records a receipt for that project revision. Review perspective, front, side, and top with clipId null; use perspective cycle for every authored clip. Inspect returns only the reviews still missing on the current revision. A cycle resolves after one full observed duration and a paused closing frame. Unfaithful preview features fail closed.'
    }
  },
  modeling: {
    authority:
      'The agent specifies project-space semantic parts, parent relationships, optional joint intent, material IDs, and base colors. ashfox derives fixed joints by default, attachment anchors, pivots, shallow seam snaps, and intersecting-cell ownership, then alone creates bones, cuboids, stable IDs, UVs, atlas pixels, and texture resolution. Raw bone and cube commands are unavailable to agents.',
    canonicalState:
      'ProjectDocument.modeling stores one normalized, sorted internal part and material recipe, including authored shallow intersections and engine-derived attachment data. Generated scene structure is its deterministic single-owner projection for rendering and export; validation rejects a missing recipe, excessive penetration, consumed parts, or structural drift, while UV and raster caches are rederived.',
    intent:
      'project.intent.set persists the literal subject, review direction, grounding, required feature notes, required part/material/clip IDs, and only the exact symmetry pairs that truly apply. Code checks shape, used material IDs, non-empty required clips, grounding, and declared lattice reflections; the rendered subject and feature notes still require visual judgment.',
    grounding:
      'Grounded assets require contact at lattice y=0 and a uniform-volume center of mass whose xz projection lies inside the convex hull of all ground-contact cell corners. This is a deterministic static-support check, not a simulation or a semantic quality score.',
    lattice:
      'All agent-authored part coordinates, radii, sizes, and thicknesses are integer lattice units. With surface density d in 1, 2, or 4, one lattice unit equals 1/d model unit. Density is immutable while compiled parts exist, so select it before authoring.',
    hierarchy:
      'A model has exactly one root part. Every child names parentPartId and may name a joint; attachment coordinates are not agent input. Author all primitive coordinates in project space, touching, shallowly intersecting, or within two lattice cells of the parent. ashfox deterministically snaps the child, derives the nearest shared-face anchor and pivot, and reapplies them when parent geometry changes. The child must remain connected and visible. Stable animation bone IDs are bone:<partId>.',
    joints: {
      fixed:
        'Rigid child relationship with no child transform channels. The one fixed root may carry global asset animation.',
      hinge:
        'Rotation only on the declared x, y, or z axis; every other component must remain numeric zero.',
      ball:
        'Rotation channels only, with movement inherited from the parent.'
    },
    primitives: {
      mass:
        'Rounded or blocky volume from center, positive radii, and soft|balanced|hard profile.',
      segment:
        'Tapered sweep through 2-8 local points with one positive 3-axis radius per point and a profile.',
      plate:
        'Extruded triangle, trapezoid, or rectangle from plane xy|xz|yz, local origin, ordered 2D outline, and positive thickness.',
      radial:
        'Axis-aligned disk or ring from center, axis, outerRadius, smaller innerRadius, and positive depth.',
      feature:
        'Small surface relief from face, local anchor, positive 2D size, and depth. Give focal accents a separate high-contrast material and use density 2 or 4 when needed.'
    },
    defaults:
      'Omitted parentPartId, joint, profile, innerRadius, and relief normalize to null, fixed, balanced, 0, and 1. A child requires only parentPartId; ashfox derives its attachment.',
    limits:
      'Use at most one model.parts.upsert operation per atomic batch, at most 64 parts per upsert, and bounded checkpoints. The persisted model allows 1,024 parts and 2,097,152 occupied lattice cells; these are safety budgets, never quality targets.',
    materials:
      'model.parts.upsert receives parts plus material definitions {id,baseColor}. Reuse a material ID only with one #RRGGBB base color. model.parts.material changes complete parts; tonal pixels, UV placement, and atlas size remain derived.',
    mutations: {
      upsert:
        'model.parts.upsert creates or replaces complete parts in the persisted recipe, then projects the complete recipe. Parent parts may appear later in the payload; hierarchy and stable IDs determine seam ownership, so input order does not affect output.',
      material:
        'model.parts.material changes canonical material assignment and base color for named parts, then deterministically refreshes their projection.',
      mirror:
        'model.parts.mirror copies one complete non-root subtree through an exact lattice plane with explicit stable target IDs, then reapplies canonical seam ownership.',
      transform:
        'model.parts.transform translates one part and all descendants by one integer lattice vector and atomically reapplies canonical seam ownership.',
      delete:
        'model.parts.delete removes named parts, descendants, and dependent animation references atomically.'
    },
    locators:
      'Use scene.locators.create, scene.locators.update, and scene.locators.delete for the complete attachment-point lifecycle, including name, parent, transform, visibility, scale inheritance, and removal. These commands can only mutate locator nodes; generated bones and geometry remain protected.',
    enforcedInvariants: [
      'integer 1/d lattice alignment',
      'one stable bone per part and one root part',
      'one 6-connected occupied volume per part',
      'canonical emitted cuboids exactly cover single-owned cells without overlap',
      'authored seam penetration of at most two surface cells with more than 20% of every part retained',
      'no positive-volume overlap between canonical parts and foreign cubes',
      'child-parent face contact at the joint anchor',
      'orthographic silhouette contribution from every part',
      'uniform-volume static support for grounded assets',
      'stable IDs derived from partId, density, and lattice bounds',
      'generated nodes cannot be changed by raw scene commands',
      'persisted recipe and generated structural projection must match'
    ]
  },
  texture: {
    authority:
      'The agent chooses material base colors and optional density. ashfox derives external-face UVs, atlas gutters, directional tonal pixels, raster, and final atlas size once per committed batch. A connected coplanar surface with one material and direction shares one world-aligned pattern even across part or cuboid seams; material, direction, plane, and disconnected-surface boundaries intentionally differ.',
    density:
      'textures.density.set accepts 1, 2, or 4. Pixel side length is 1, 1/2, or 1/4 model unit. The atlas grows from 16×16 to 4096×4096 and never silently lowers density.',
    review:
      'After final geometry, require zero untextured visible faces and visually check material separation, intended boundaries, partially covered rectangular faces, orientation, and equal square-pixel size on every face. The constrained workflow exposes base colors and material regions, not arbitrary face painting.'
  },
  completion: {
    model:
      'Required. Build the requested silhouette, proportions, construction or anatomy, articulation, and focal details. Cube or part count is never a quality score.',
    texture:
      'Required. Use deliberate reusable material colors and satisfy the texture review.',
    idle:
      'Required. Create an idle clip with at least one transform channel and matching start/end pose. A static asset may use identical hold keys.',
    semanticBoundary:
      'Code proves structure, not subject identity or visual appeal. Compare the rendered model with the request and references; never call that judgment machine-validated.',
    review:
      'Reject a wrong body or construction plan before detail. Reject missing defining parts, generic humanoid substitution, floating parts, accidental asymmetry, hidden filler, bad pivots, unintended visible clipping, loop snaps, and details unreadable at gameplay distance.'
  },
  workflow: [
    {
      stage: 'start',
      instruction:
        'Inspect. For a fresh asset run project.create; do not click New Project. Set target and density before geometry.'
    },
    {
      stage: 'specify',
      instruction:
        'Derive a short binding part plan, then persist it with project.intent.set: literal subject, front, grounding, defining feature notes, exact required part/material/clip IDs, and only intentional exact symmetry. Do not invent a generic body plan.'
    },
    {
      stage: 'prove',
      instruction:
        'Compile the real root part first with one material, inspect it, and confirm the model-texture pipeline before adding children.'
    },
    {
      stage: 'author',
      instruction:
        'Add project-space parts in coarse-to-fine checkpoint batches. Place each child touching, shallowly intersecting, or within two lattice cells of its parent; never author attachment coordinates. Inspect the derived contact and rendered continuity. Correct silhouette and structure before features. Use model.parts.material for palette changes and model.parts.delete for removal.'
    },
    {
      stage: 'animate',
      instruction:
        'Create and close the idle loop, then any requested clips. Animate stable bone:<partId> targets within fixed, hinge, and ball joint constraints, and present every clip.'
    },
    {
      stage: 'review',
      instruction:
        'Inspect target readiness, texture coverage, Activity receipt, and viewport from front, side, and three-quarter views. Correct visible semantic issues even when machine validation passes.'
    },
    {
      stage: 'produce',
      instruction:
        'Require the canonical target, mechanicallyReady, and no remaining visual reviews. Activate the listed save, export, or capture DOM boundary and wait for the matching terminal operation.'
    }
  ],
  domBridge: {
    purpose:
      'Fallback transport only when window.ashfox is unavailable. It validates and forwards inspect, run, or present and owns no mutation logic.',
    input: {
      selector: '[data-agent-command-port-input]',
      attribute: agentCommandProtocol.inputAttribute,
      event: 'input'
    },
    result: {
      selector: 'meta[data-agent-command-port-result]',
      attribute: agentCommandProtocol.resultAttribute
    },
    encoding: 'json'
  },
  domActions: {
    openProject: '[data-ashfox-action="project.open"]',
    openProjectInput: '[data-ashfox-action="project.open.input"]',
    saveProject: '[data-ashfox-action="project.save"]',
    openExport: '[data-ashfox-action="project.export.open"]',
    submitExport: '[data-ashfox-action="project.export.submit"]',
    openCapture: '[data-ashfox-action="project.capture.open"]',
    startCapture: '[data-ashfox-action="project.capture.start"]',
    cancelCapture: '[data-ashfox-action="project.capture.cancel"]',
    downloadArtifact: '[data-ashfox-action="artifact.download"]'
  },
  domState: {
    root: '[data-agent-command-port]',
    statusAttribute: 'data-agent-command-port',
    revisionAttribute: 'data-ashfox-revision',
    artifact: {
      action: 'downloadArtifact',
      nameAttribute: 'data-ashfox-artifact-name',
      contentTypeAttribute: 'data-ashfox-artifact-content-type',
      byteLengthAttribute: 'data-ashfox-artifact-byte-length'
    },
    fileOperation: {
      phaseAttribute: 'data-ashfox-file-operation',
      kindAttribute: 'data-ashfox-file-kind',
      operationIdAttribute: 'data-ashfox-file-operation-id',
      messageSelector: '[data-ashfox-file-message]',
      terminalPhases: ['idle', 'succeeded', 'cancelled', 'failed']
    }
  },
  export: {
    precondition:
      'Satisfy completion, perform the mandatory visual review, and require inspect kind target mechanicallyReady true. Mechanical readiness proves only deterministic structure and target compatibility.',
    targets: {
      geckolib5:
        'ZIP with geometry JSON, animation JSON, and external PNG textures.',
      bedrock:
        'ZIP with Bedrock geometry JSON, animation JSON, and PNG textures.',
      gltf:
        'ZIP with .gltf, external .bin, and PNG textures.',
      glb:
        'One self-contained binary GLB with buffers, textures, and animation.'
    },
    operation:
      'Use project.target.set through run only when the requested target differs. Export has no agent-entered fields: activate openExport, then submitExport once; format, namespace, and model path are derived from the canonical project target. Require succeeded, positive byte length, and matching operation ID before downloadArtifact.'
  },
  recovery: {
    projectMismatch:
      'Inspect the active project and discard commands prepared for another baseProjectId. Never transplant an old-project batch by changing only its project ID.',
    staleRevision:
      'Inspect again and retry once with a new batchId and returned revision.',
    invalidPayload:
      'Read the command schema, correct the rejected path, and use a new batchId.',
    invalidState:
      'Correct the reported recipe, projection, parent, material, connectivity, excessive seam penetration, consumed part, canonical ownership, foreign-geometry conflict, silhouette, grid, rig, budget, or target invariant. Failed batches changed nothing.',
    noChange:
      'Treat no_change as terminal confirmation that the requested state is current.',
    duplicateExecution:
      'Reuse a batchId only for an identical retry.',
    cancellationOrException:
      'Treat the failure as terminal, inspect status and revision, then decide whether to retry.'
  },
  delivery: {
    requestedPath: 'workspace-relative directory',
    defaultDirectory: 'artifacts/',
    owner: 'agent host',
    steps: [
      'Reject paths outside the active workspace.',
      'Activate downloadArtifact after a succeeded operation and transfer it directly; never copy bytes through model context.',
      'Verify the file exists and report its actual workspace-relative path and format.'
    ]
  },
  commands
} as const;
