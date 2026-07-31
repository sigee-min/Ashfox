import {
  listAgentCommandDefinitions
} from '@ashfox/engine-core';

import {
  agentCommandProtocol
} from './agentCommandProtocol';
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
    'Machine guide for creating complete low-poly assets with ashfox.',
  setup: {
    manifest:
      'Fetch this JSON with a direct HTTP request such as curl. Do not navigate the controlled browser away from the workbench.',
    browser:
      'Open /workbench/ in an in-app browser. Use a connected browser when an in-app browser is unavailable.',
    ready:
      'Inspect the active project, then ask exactly: "What would you like to create?" Do not change the project before the user answers.'
  },
  pageApi: {
    global: 'ashfox',
    inspectMethod: 'inspect',
    runMethod: 'run',
    presentMethod: 'present',
    deliverMethod: 'deliver',
    inspect: {
      current:
        'window.ashfox.inspect() returns the current revision, stage, first blocker, up to three recommended commands, counts, target, and remaining visual reviews.',
      command:
        'window.ashfox.inspect({kind:"command",name:"<command>"}) returns the exact current input schema. Read it immediately before using an unfamiliar command.',
      parts:
        'window.ashfox.inspect({kind:"parts",ids:["<partId>"]}) returns authorable project-space specs. Reapplying an unchanged inspected spec is a visual no-op.',
      catalog:
        'Use kind catalog for bounded part, texture, and clip IDs; kind target for readiness; kind finding for one blocker; kind activity for receipts.'
    },
    run: {
      call:
        'await window.ashfox.run({operations:[{name:"<command>",payload:{}}]})',
      contract:
        'Submit 1-64 operations. The port supplies project ID, revision, and request identity. Compilation, generated textures, validation, and commit are one atomic reducer transaction.',
      terminal:
        'Success, no change, invalid input, stale state, cancellation, duplicate transport request, and exceptions all resolve once and restore connected status.'
    },
    present: {
      call:
        'await window.ashfox.present({review:"next"})',
      contract:
        'The workbench selects the next missing revision-bound view or animation cycle. Repeat only while inspect reports remaining reviews. A receipt is recorded only after the renderer observes the requested frame or complete loop.'
    },
    deliver: {
      call: 'await window.ashfox.deliver()',
      contract:
        'No export payload is accepted. The canonical target and active revision determine the artifact. Delivery rejects mechanical blockers or unfinished visual reviews and returns name, target, byte length, and SHA-256 hash.'
    }
  },
  authoring: {
    project:
      'Start with project.create {name,target?,density?}. Target defaults to glb and density defaults to 1. IDs, timestamps, namespace, and model path are derived. Use density 2 or 4 for smaller surface pixels before adding geometry.',
    intent:
      'Set project.intent.set with the literal subject. Add grounding and short defining features when useful. Exact required IDs and symmetry pairs are optional contracts, not planning boilerplate.',
    coordinates:
      'Author integer lattice coordinates in project space: +x east, +y up, +z south. At density d, one lattice unit is 1/d model unit. Plate outline points alone are relative to their project-space origin.',
    hierarchy:
      'Create exactly one root. Children name parentPartId and touch, shallowly intersect, or begin within two lattice cells of the parent. ashfox derives snap, shared-face anchor, pivot, seam ownership, bones, cuboids, UVs, and texture pixels.',
    parts: {
      mass: 'Blocky or rounded volume: center, radii, optional profile.',
      segment:
        'Tapered sweep: 2-8 project-space points and one three-axis radius per point.',
      plate:
        'Extruded triangle, trapezoid, or rectangle: plane, origin, ordered outline, thickness.',
      radial:
        'Axis-aligned disk or ring: center, axis, outer radius, optional inner radius, depth.',
      feature:
        'Small parent-bound surface relief: face, anchor, size, optional relief.'
    },
    joints:
      'Omit joint for rigid attachment. A hinge rotates around one declared axis; a ball joint rotates around XYZ. Existing omitted parent, joint, profile, inner radius, and relief values are preserved during upsert.',
    materials:
      'Every part names a materialId. Define a new material once in optional materials [{id,baseColor}]; later edits can send parts only. ashfox derives directional tonal variation, equal square surface pixels, UV gutters, raster, and atlas size.',
    mutations:
      'Use model.parts.upsert for creation or patch-safe replacement, material for palette reassignment, transform for a subtree move, mirror for intentional reflection, and delete for removal. Inspect affected parts after structural edits.'
  },
  animation: {
    command:
      'Use animation.motion.upsert. It creates or replaces one complete previewable numeric clip and derives clip name, bone/channel/key IDs, 20 FPS sampling, interpolation, and loop closure.',
    idle:
      'Every asset needs idle. {clipId:"idle",role:"idle"} creates a valid static hold when no motion is needed.',
    motion:
      'For motion, send partId and keys with phase from 0 to 1. Hinge rotationDegrees is one scalar; root and ball rotationDegrees are [x,y,z]. Fixed children cannot be animated.',
    review:
      'Inspect after each clip, then let present select and observe its required complete cycle.'
  },
  quality: {
    required:
      'A complete asset has intentional geometry, generated texture coverage, and idle animation. Part count is never a quality target.',
    structure:
      'Prioritize a recognizable silhouette, correct anatomy or construction, believable proportions, connected major masses, readable focal features, and useful articulation before small detail.',
    fidelity:
      'Follow the requested subject rather than substituting a generic humanoid or generic vehicle. For creatures, preserve body plan, limb placement, head-to-body relationship, posture, and defining anatomy. Use contrasting texture detail for eyes and other focal features when present.',
    review:
      'Machine checks prove structure and export compatibility, not identity or appeal. Reject missing defining parts, floating pieces, swallowed geometry, accidental symmetry, unintended clipping, bad pivots, loop snaps, and details unreadable at gameplay distance.'
  },
  workflow: [
    {
      stage: 'start',
      instruction:
        'Inspect. If the project is empty, use project.create with name, target, and density in one command.'
    },
    {
      stage: 'plan',
      instruction:
        'Set the literal subject and a short feature plan. Choose one correct body or construction plan before coordinates.'
    },
    {
      stage: 'model',
      instruction:
        'Author the root, inspect, then add connected parts coarse-to-fine in bounded batches. Correct silhouette and proportions before features.'
    },
    {
      stage: 'animate',
      instruction:
        'Create idle with animation.motion.upsert, then requested loops or one-shots using part phases and joint-aware rotations.'
    },
    {
      stage: 'review',
      instruction:
        'Follow inspect blockers. Call present({review:"next"}) until the current revision has no remaining visual reviews.'
    },
    {
      stage: 'deliver',
      instruction:
        'Call deliver() only when mechanically ready and visually reviewed. Transfer the prepared artifact without copying bytes through model context.'
    }
  ],
  recovery: {
    invalidInput:
      'Inspect the named command schema, correct only the reported path, and submit again.',
    invalidState:
      'Inspect the first blocker and follow its recommended command. A failed atomic request changed nothing.',
    concurrent:
      'Wait for the current promise to settle. Do not prepare revisions or request IDs manually.',
    visual:
      'If the rendered subject is wrong despite valid structure, revise the part plan rather than adding filler detail.'
  },
  domBridge: {
    purpose:
      'Fallback transport when window.ashfox is unavailable. It forwards inspect, run, present, or deliver and owns no project mutation.',
    request:
      '{"requestId":"unique-id","method":"inspect|run|present|deliver","payload":"omit only for deliver"}',
    response:
      '{"requestId":"same-unique-id","result":{"ok":true|false,"revision":"..."}}',
    examples: {
      inspect:
        '{"requestId":"inspect-1","method":"inspect","payload":{"kind":"target"}}',
      run:
        '{"requestId":"run-1","method":"run","payload":{"operations":[{"name":"project.create","payload":{"name":"My asset"}}]}}',
      present:
        '{"requestId":"present-1","method":"present","payload":{"review":"next"}}',
      deliver:
        '{"requestId":"deliver-1","method":"deliver"}'
    },
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
  artifact: {
    downloadSelector: '[data-ashfox-action="artifact.download"]',
    requestedPath: 'workspace-relative directory',
    defaultDirectory: 'artifacts/',
    rule:
      'After deliver succeeds, transfer the prepared artifact through the connected browser, verify the actual file, and report its workspace-relative path and format.'
  },
  commands
} as const;
