import { listAgentCommandDefinitions } from '@ashfox/engine-core';

import { agentCommandProtocol } from './agentCommandProtocol';

const commands = listAgentCommandDefinitions().map((definition) => ({
  name: definition.name,
  purpose: definition.purpose,
  inputSchema: definition.inputSchema
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
        'window.ashfox.inspect() returns revision, target, density, texture resolution, typed counts, agent command names, and the first blocking finding.',
      command:
        'window.ashfox.inspect({kind:"command",name:"<commands entry>"}) returns the canonical input schema.',
      catalog:
        'window.ashfox.inspect({kind:"catalog"}) lists existing part, texture, and clip IDs after a reopen or handoff.',
      parts:
        'window.ashfox.inspect({kind:"parts",ids:["<partId>"]}) returns up to 10 exact persisted PartSpecs and materials plus compiled bone IDs, cube counts, and model-space bounds.',
      entities:
        'Use kind entity, texture, or clip with at most 10 IDs for exact canonical values.',
      validation:
        'Use kind target for export and production readiness; use kind finding with a path for one exact finding.'
    },
    run: {
      call:
        'await window.ashfox.run({batchId:"<unique>",baseRevision:"<current>",operations:[{name:"<command>",payload:{}}]})',
      atomicity:
        'A batch contains 1-64 agent commands. Compilation, texture derivation, structural validation, and target validation either commit together or leave the project unchanged.',
      idempotency:
        'For the connected page session, the same batchId and content returns its completed result. Reusing a batchId for different content is rejected.',
      concurrency:
        'Submit one batch at a time. Success, rejection, no_change, stale revision, cancellation, and exception are terminal and restore connected status.'
    },
    present: {
      call:
        'window.ashfox.present({kind:"animation",clipId:"<clip>",playing:true,timeSeconds:0})',
      review:
        'Play every authored clip through at least one loop, then pause with playing false. Presentation never mutates the document.'
    }
  },
  modeling: {
    authority:
      'The agent specifies semantic parts, attachments, joints, material IDs, and base colors. ashfox alone creates bones, cuboids, stable IDs, UVs, atlas pixels, and texture resolution. Raw bone and cube commands are unavailable to agents.',
    canonicalState:
      'ProjectDocument.modeling stores one normalized, sorted PartSpec and material recipe. Generated scene structure is its deterministic projection for rendering and export; validation rejects a missing recipe or structural drift, while UV and raster caches are rederived.',
    lattice:
      'All PartSpec coordinates, radii, sizes, anchors, and thicknesses are integer lattice units. With surface density d in 1, 2, or 4, one lattice unit equals 1/d model unit. Density is immutable while compiled parts exist, so select it before authoring.',
    hierarchy:
      'A model has exactly one root part. Every child names parentPartId, joint, and attachment. Child geometry is local and translated by parentAnchor - partAnchor; the compiled child must share a lattice face with its parent. Stable animation bone IDs are bone:<partId>.',
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
      'Omitted parentPartId, joint, attachment, profile, innerRadius, and relief normalize to null, fixed, null, balanced, 0, and 1. A child still requires an explicit parentPartId and attachment anchors.',
    limits:
      'Use at most one model.parts.upsert operation per atomic batch, at most 64 parts per upsert, and bounded checkpoints. The persisted model allows 1,024 parts and 2,097,152 occupied lattice cells; these are safety budgets, never quality targets.',
    materials:
      'model.parts.upsert receives parts plus material definitions {id,baseColor}. Reuse a material ID only with one #RRGGBB base color. model.parts.material changes complete parts; tonal pixels, UV placement, and atlas size remain derived.',
    mutations: {
      upsert:
        'model.parts.upsert creates or replaces complete parts in the persisted recipe, then projects the complete recipe. Parent parts may appear later in the payload; input order does not affect output.',
      material:
        'model.parts.material changes canonical material assignment and base color for named parts, then deterministically refreshes their projection.',
      delete:
        'model.parts.delete removes named parts, descendants, and dependent animation references atomically.'
    },
    enforcedInvariants: [
      'integer 1/d lattice alignment',
      'one stable bone per part and one root part',
      'one 6-connected occupied volume per part',
      'exact, non-overlapping cuboid coverage',
      'no positive-volume overlap between parts or foreign cubes',
      'child-parent face contact at the joint anchor',
      'orthographic silhouette contribution from every part',
      'stable IDs derived from partId, density, and lattice bounds',
      'generated nodes cannot be changed by raw scene commands',
      'persisted recipe and generated structural projection must match'
    ]
  },
  texture: {
    authority:
      'The agent chooses material base colors and optional density. ashfox derives external-face UVs, atlas gutters, directional tonal pixels, raster, and final atlas size once per committed batch. Pattern continuity is guaranteed only for the same part, material, direction, and coplanar lattice surface; direction, material, and part boundaries intentionally differ.',
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
      'Reject a wrong body or construction plan before detail. Reject missing defining parts, generic humanoid substitution, floating parts, accidental asymmetry, hidden filler, bad pivots, clipping, loop snaps, and details unreadable at gameplay distance.'
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
        'Derive a short binding part plan: primary axis and stance, defining silhouette, proportions, supports, appendage count and attachment, joints, material regions, and required motion. Do not invent a generic body plan.'
    },
    {
      stage: 'prove',
      instruction:
        'Compile the real root part first with one material, inspect it, and confirm the model-texture pipeline before adding children.'
    },
    {
      stage: 'author',
      instruction:
        'Add connected parts in coarse-to-fine checkpoint batches. Correct silhouette and structure before features. Use model.parts.material for palette changes and model.parts.delete for removal.'
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
        'Set the final target, require productionReady, then use the listed save, export, or capture DOM boundary and wait for the matching terminal operation.'
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
  domFields: {
    format: '[role="radiogroup"][aria-label="Format"]',
    namespace: '[aria-label="Project namespace"]',
    modelPath: '[aria-label="Project model path"]'
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
      'Satisfy completion, perform texture review, and require inspect kind target productionReady true. This gate does not replace semantic review.',
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
      'Use project.target.set through run, activate openExport, set format, namespace, and modelPath, then activate submitExport once. Require succeeded, positive byte length, and matching operation ID before downloadArtifact.'
  },
  recovery: {
    staleRevision:
      'Inspect again and retry once with a new batchId and returned revision.',
    invalidPayload:
      'Read the command schema, correct the rejected path, and use a new batchId.',
    invalidState:
      'Correct the reported recipe, projection, parent, material, connectivity, overlap, silhouette, grid, rig, budget, or target invariant. Failed batches changed nothing.',
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
