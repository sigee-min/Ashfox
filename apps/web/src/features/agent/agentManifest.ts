import { listCommandDefinitions } from '@ashfox/engine-core';

import { agentCommandProtocol } from './agentCommandProtocol';

const commands = listCommandDefinitions().map((definition) => ({
  name: definition.name,
  purpose: definition.purpose,
  inputSchema: definition.inputSchema
}));

export const agentManifest = {
  protocol: agentCommandProtocol.protocol,
  workbench: agentCommandProtocol.workbench,
  href: agentCommandProtocol.href,
  description:
    'Complete machine-readable operating guide for the ashfox AI-native low-poly workbench.',
  setup: {
    manifest:
      'Fetch this JSON with the direct HTTP request tool available in the agent environment, such as curl. Never navigate the controlled browser to the manifest.',
    browser:
      'Open the workbench in an in-app browser. If unavailable, use a browser the agent can connect to and control. Reserve the browser for the workbench UI and page API.',
    authority:
      'This manifest is the complete ashfox operating guide. Do not infer a second workflow from visible UI.',
    ready:
      'After the page API is connected and the current project is inspected, ask exactly: "What would you like to create?" Do not mutate the project before the user answers.'
  },
  pageApi: {
    global: 'ashfox',
    inspectMethod: 'inspect',
    runMethod: 'run',
    presentMethod: 'present',
    inspect: {
      current:
        'window.ashfox.inspect() returns the current revision, project identity, surface pixel density, derived texture resolution, selection, typed scene and animation counts, complete command-name list, and first blocking finding.',
      command:
        'window.ashfox.inspect({kind:"command",name:"<command>"}) returns one canonical input schema.',
      entities:
        'Use kind entity, texture, or clip with ids (maximum 10) to read exact current values.',
      validation:
        'Use kind target for format validity, production readiness, error and warning counts, texture count, and the first readiness finding; use kind finding with a path for one exact finding.'
    },
    run: {
      call:
        'await window.ashfox.run({batchId:"<unique>",baseRevision:"<current>",operations:[{name:"<command>",payload:{}}]})',
      atomicity:
        'Each batch contains 1-64 registered operations and commits atomically through the canonical reducer.',
      idempotency:
        'Repeating the same batchId with identical content returns its completed result. Reusing it for different content is rejected.',
      concurrency:
        'Only one batch runs at a time. Every success, rejection, timeout, cancellation, or exception returns a terminal result and restores connected status.'
    },
    present: {
      call:
        'window.ashfox.present({kind:"animation",clipId:"<clip>",playing:true,timeSeconds:0})',
      purpose:
        'Select and play one existing animation clip in the rendered viewport without mutating the project document or revision.',
      review:
        'Present every authored clip, observe at least one complete loop or playback, then pause it with playing false before final delivery.'
    }
  },
  completionContract: {
    defaultScope: {
      model:
        'Required. Deliver coherent named geometry under a usable bone hierarchy; a project shell or proof cube is not a finished model.',
      texture:
        'Required. Choose a deliberate #RRGGBB baseColor for every material region and satisfy textureContract. Final inspect must show untexturedVisibleFaces 0 and texturedVisibleFaces equal enabledVisibleFaces.',
      idleAnimation:
        'Required for every asset. Use animation.<asset>.idle for Minecraft targets or Idle for glTF/GLB, with at least one transform channel and matching start and end poses. Add a changed intermediate pose only when motion is semantically valid; otherwise use identical hold keys. Final inspect must show idleClips and idleChannels at least 1. Present and review one complete loop.',
      readiness:
        'Required machine gate. Final inspect kind target must report productionReady true, but this does not replace semantic and visual review.'
    },
    verificationBoundary: {
      machine:
        'Code verifies only explicit structural facts: schema, hierarchy, references, transforms, fully occluded static cubes, UV and texture coverage, animation timing, and target compatibility.',
      semantic:
        'Subject identity, silhouette fidelity, anatomy or construction accuracy, and visual appeal are not deterministically provable from counts or invariants. The agent must compare the rendered result with the request and supplied references and must not describe that judgment as machine-validated.'
    },
    subjectFidelity: {
      general:
        'Before editing, derive a concise subject specification from the request and supplied references: defining silhouette, proportions, body or construction plan, articulation, and material regions. Treat it as binding; never substitute a familiar generic body or rig.',
      bodyPlan:
        'Lock the primary body axis and stance, support points, head-to-body ratio, mass distribution, limb or appendage count and attachment, and joint directions before surface detail. Reject an upright human torso, human shoulder or pelvis layout, or human limb proportions unless the requested subject actually has them.',
      eyes:
        'When visible eyes define the subject, shape the socket, lid, and head first, then use the smallest flush whole-unit cubes and restrained baseColor contrast needed for iris, pupil, or highlight readability. Do not default to protruding, floating, or emissive eyes.'
    },
    reviewGates: {
      form:
        'At the coarse stage, reject a body plan or silhouette that does not identify the requested subject before adding detail. Every part must contribute to silhouette, structure, articulation, construction, or readable detail; resolve every cube.fully_occluded warning and reject hidden filler, accidental duplicates, and imperceptible splitting. Also reject missing defining parts, accidental asymmetry, floating pieces, avoidable interpenetration, and z-fighting. Do not trade recognition or reference fidelity for ornamental density.',
      texture:
        'Reject placeholder base colors, unintended UV stretching or rotation, broken seams, inconsistent texel scale, and identity-defining color regions that disappear at gameplay distance. Do not hand-author tonal gradients, noise, or edge effects; apply textureContract.review after the final generated-surface change.',
      rig:
        'Place pivots at plausible joints or mechanical axes. Verify hierarchy motion does not detach, shear, or move unrelated parts.',
      idle:
        'Reject loop-end snapping, unintended root drift, constant-speed robotic motion where easing is expected, and secondary motion that contradicts weight or construction.',
      final:
        'Compare the rendered result with subjectFidelity, then inspect target readiness, texture coverage, and the idle clip before claiming completion.'
    }
  },
  textureContract: {
    authority:
      'The agent owns each cube material baseColor and may select project surfacePixelDensity through textures.density.set. ashfox owns the generated texture, UV atlas, raster pixels, and derived atlas resolution.',
    material:
      'Pass one deliberate #RRGGBB baseColor when creating a cube, or use scene.cubes.material with nodeIds and baseColor to recolor an existing material region. Reuse the exact same baseColor for cubes that share a material. Do not encode highlights, shadows, noise, gradients, or edge darkening in the chosen color.',
    generated: {
      bootstrap:
        'scene.cubes.create automatically creates or reuses the canonical generated texture and assigns every enabled face. The texture identity and face mapping are not command inputs.',
      derivation:
        'At the end of every run batch, ashfox automatically packs every positive-area face and derives UVs, raster pixels, padding, and atlas size exactly once before commit. Derivation failure rejects the entire batch.',
      density:
        'textures.density.set accepts density 1, 2, or 4. The same batch automatically updates surfacePixelDensity, UVs, surface pattern, padding, and atlas size. Pixel side length is respectively 1, 1/2, or 1/4 model unit in pixel-unit projects. Use 1 by default and raise it only when smaller surface pixels materially improve the asset.',
      grid:
        'For pixel-unit projects, every effective cube dimension after inflate and scale must align to 1/surfacePixelDensity model-unit increments. A face that cannot produce exact square texels is rejected atomically; correct the geometry or deliberately change density.',
      surfacePattern:
        'ashfox derives a deterministic pixel-art tonal pattern from baseColor using canonical direction, edge contrast, and pixel variation rules. The result is baked albedo data, not scene lighting, and uses the fixed square texel grid at every face size. The same geometry and baseColor always produce the same texture.'
    },
    review:
      'After the final geometry batch, inspect texture coverage and visually check baseColor separation, seams, face orientation, and identical square-pixel size across every face.',
    limits:
      'The generated atlas grows from 16 × 16 up to 4096 × 4096 while preserving the selected surfacePixelDensity. If it cannot fit, simplify geometry or explicitly select a lower density; ashfox never silently reduces it.'
  },
  authoringModel: {
    project:
      'project.create replaces the active document. Existing projects may be edited with project.rename and project.target.set; submit related project edits in one run batch. Project ID and createdAt are immutable after creation. A target change rewrites canonical format metadata and Minecraft resource bindings; changing an animation-free project to GeckoLib 5 provisions a required rest-pose clip, which does not replace the idle requirement in completionContract.',
    identity:
      'Project, scene-node, texture, clip, channel, trigger, and key IDs are unique stable strings. Names are human-readable and may change without changing IDs.',
    coordinates:
      'Scene values use a right-handed Y-up coordinate system. Geometry and pivots use pixel units; rotations use degrees in XYZ order; animation time uses seconds.',
    hierarchy:
      'Bones may parent bones, cubes, or locators. parentId null makes a root. scene.bones.create permits parent IDs declared anywhere in the same payload. Use scene.locators.create for particle and sound attachment points; Minecraft locators must be parented to an existing bone. Use scene.nodes.reparent for hierarchy changes and scene.nodes.delete for atomic cascading removal.',
    cubes:
      'Cube bounds are absolute from/to coordinates and must not be reversed. Use whole-unit effective dimensions for the texture grid. Use scene.cubes.geometry.update only for bounds and inflate, scene.cubes.material only for baseColor, scene.cubes.mirror for mirrored geometry, and scene.nodes.transform for position, rotation, scale, and pivot. Texture IDs, UV fields, atlas resolution, and raster pixels are derived and are not public command inputs.',
    animation:
      'Clips own transform channels and event triggers. Channels target stable node IDs and animate position, rotation, or scale with ordered keys. Particle and sound effects may reference locator node IDs. Use animation.tracks.delete with explicit channel or trigger kinds for precise removal without rebuilding the clip. Keep keys within clip duration and close loops explicitly when required.',
    targets: {
      bedrock:
        'Minecraft Bedrock geometry and animation JSON with external PNG textures.',
      geckolib5:
        'GeckoLib 5 Java resources with geometry, animation, and external PNG textures.',
      gltf:
        'glTF JSON with an external binary buffer and external PNG textures.',
      glb:
        'One binary GLB with embedded buffers and texture images.'
    }
  },
  commands,
  domBridge: {
    purpose:
      'Fallback transport only when window.ashfox is unavailable. It validates and forwards the same inspect, run, or present request and owns no mutation logic.',
    input: {
      selector: '[data-agent-command-port-input]',
      attribute: agentCommandProtocol.inputAttribute,
      event: 'input'
    },
    result: {
      selector: 'meta[data-agent-command-port-result]',
      attribute: agentCommandProtocol.resultAttribute
    },
    encoding: 'json',
    request: {
      requestId: 'unique string',
      method: 'inspect, run, or present',
      payload: 'method input'
    },
    response: {
      requestId: 'matching request ID',
      result: 'InspectResult, RunResult, or PresentResult'
    }
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
      terminalPhases: [
        'idle',
        'succeeded',
        'cancelled',
        'failed'
      ]
    }
  },
  exportContract: {
    precondition:
      'Satisfy completionContract, perform textureContract.review, then inspect kind target and require productionReady true. Save and export commit any required target preparation through the canonical reducer before artifact creation. valid or productionReady alone does not prove visual completion.',
    select:
      'Use project.target.set through run before opening export. Public targets are geckolib5, bedrock, glb, and gltf.',
    submit:
      'Activate openExport, set the exact format, namespace, and modelPath fields, then activate submitExport once. Wait for a terminal file-operation phase with the same operation ID.',
    outputs: {
      geckolib5:
        'Completed-asset ZIP containing geometry JSON, animation JSON with the reviewed idle, and every referenced PNG texture under canonical GeckoLib and texture paths.',
      bedrock:
        'Completed-asset ZIP containing geometry JSON, animation JSON with the reviewed idle, and every referenced PNG texture.',
      gltf:
        'Completed-asset ZIP containing one .gltf entrypoint with the reviewed idle, one external .bin buffer, and every referenced PNG texture.',
      glb:
        'One completed-asset .glb containing the reviewed idle, model buffer, and all referenced texture images.'
    },
    verify:
      'Require succeeded status, a non-empty artifact name, positive byte length, and the expected content type: model/gltf-binary for GLB or application/zip for the other public targets. Then activate downloadArtifact exactly once and verify the host-side file exists.'
  },
  workflow: [
    {
      stage: 'start',
      instruction:
        'Call inspect. To start fresh, run project.create with a new project ID; do not operate the New Project UI. To open a user file, activate openProject and let the user choose it. A cancelled picker starts no operation.'
    },
    {
      stage: 'prove',
      instruction:
        'Before bulk authoring, prove the pipeline with the first real model part: create its root and one whole-unit cube with a deliberate baseColor, then inspect. This checkpoint proves geometry, automatic texture derivation, and command flow only; it is not completion or quality proof.'
    },
    {
      stage: 'author',
      instruction:
        'Follow completionContract coarse-to-fine in checkpoint batches: locked body-plan silhouette and hierarchy, meaningful geometry and articulation, textureContract, then idle. Use textureContract.generated.derivation, command schemas in this manifest, and inspect after each checkpoint. Correct subject fidelity before adding detail.'
    },
    {
      stage: 'review',
      instruction:
        'Apply every completionContract.reviewGates and defaultScope item. Inspect target readiness; review the viewport, Activity receipt, and Undo. Present every clip through a complete motion, then pause it.'
    },
    {
      stage: 'produce',
      instruction:
        'Set the final target with project.target.set, inspect it, apply completionContract review, then use saveProject and follow exportContract for export. For GIF use openCapture and startCapture. Wait for a terminal file phase with the same operation ID.'
    },
    {
      stage: 'deliver',
      instruction:
        'Activate downloadArtifact only after a succeeded file operation, then transfer and verify the downloaded file according to delivery.'
    }
  ],
  recovery: {
    staleRevision:
      'Inspect again and retry once with a new batchId and the returned revision.',
    invalidPayload:
      'Use the command inputSchema in this manifest, correct the rejected path, and submit a new batchId.',
    noChange:
      'Treat no_change as a terminal result that confirms the requested state is already current. Inspect and continue; do not retry it with another batchId.',
    duplicateExecution:
      'Reuse a batchId only for an identical retry; otherwise generate a new unique ID.',
    busy:
      'Wait for the current run to return a terminal result before submitting another batch.',
    cancellationOrException:
      'Treat the returned failure as terminal. Inspect status and revision before deciding whether to retry.'
  },
  delivery: {
    requestedPath: 'workspace-relative directory',
    defaultDirectory: 'artifacts/',
    owner: 'agent host',
    steps: [
      'Reject paths outside the active workspace.',
      'Activate the persistent artifact anchor, then transfer the download directly into the requested directory; never rely on auto-download and never copy its bytes through model context.',
      'Verify the file exists, then report only its actual workspace-relative path and format.'
    ],
    fallback:
      'If the host cannot download, write, or verify the file, report the last completed boundary exactly; never claim a workspace save.'
  },
  rules: [
    'Inspect before authoring and use the returned current revision.',
    'Every delivery must satisfy completionContract; productionReady alone never proves visual or semantic completion.',
    'Follow textureContract as the only texture, UV, raster, and automatic surface-pattern workflow.',
    'Commit each proven authoring phase atomically; never submit an entire unproven high-detail asset as one batch.',
    'All project mutations use run and the canonical reducer; the bridge contains no mutation logic.',
    'Use DOM actions only for listed file boundaries; accept completion only at a terminal phase with the same operation ID.'
  ]
} as const;
