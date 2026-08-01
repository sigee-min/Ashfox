import {
  exportCompatibilityOptions,
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

const compatibility = exportCompatibilityOptions();

export const agentManifest = {
  protocol: agentCommandProtocol.protocol,
  workbench: agentCommandProtocol.workbench,
  href: agentCommandProtocol.href,
  description:
    'Canonical machine guide for creating, reviewing, capturing, and exporting one complete low-poly asset with ashfox.',
  compatibility: {
    options: compatibility,
    contract:
      'Choose only a listed target and gameVersion pair. Omit gameVersion for glTF or GLB. If a Minecraft gameVersion is omitted, ashfox selects that target’s curated default. gameVersion is the tested consumer compatibility target; listed versions may share stable geometry or animation schema values. animationSupport "none" omits clips from the artifact while keeping the canonical source unchanged; "actor" and "scene" require canonical idle.'
  },
  setup: {
    manifest:
      'Fetch this JSON with a direct system HTTP request such as curl. Do not navigate the controlled browser away from the workbench.',
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
    captureMethod: 'capture',
    deliverMethod: 'deliver',
    inspect: {
      current:
        'window.ashfox.inspect() returns the active operation, current revision, stage, first blocker, up to three bounded nextActions, counts, canonical export target, and remaining visual reviews. An operation action is ready to submit; a command action requires its current schema and project-specific payload.',
      command:
        'window.ashfox.inspect({kind:"command",name:"<command>"}) returns the exact current input schema. Read it immediately before using an unfamiliar command.',
      parts:
        'window.ashfox.inspect({kind:"parts",ids:["<partId>"]}) returns authorable project-space specs. Reapplying an unchanged inspected spec is a visual no-op.',
      clip:
        'window.ashfox.inspect({kind:"clip",id:"<clipId>"}) returns paged authoring track summaries. Add trackId to page through exact keys for one track; follow nextCursor and never infer omitted keys.',
      catalog:
        'Use kind catalog for bounded part, texture, and clip IDs; kind target for readiness and artifact state; kind finding for one blocker; kind activity for reducer receipts. Exact-ID inspection returns not_found for an unknown ID.'
    },
    run: {
      call:
        'await window.ashfox.run({requestId:"stable-unique-id",operations:[{name:"<command>",payload:{}}]})',
      contract:
        'Submit 1-64 operations. The port supplies project ID and revision. Compilation, generated textures, full validation, and commit are one atomic reducer transaction. During the current page session, retrying the exact same requestId and operations returns the same terminal result; reusing an ID for different content is rejected.',
      terminal:
        'Success, no change, invalid input, stale state, cancellation, duplicate delivery, and exceptions all resolve once and release the working state.'
    },
    present: {
      call:
        'await window.ashfox.present({review:"next"})',
      accept:
        'await window.ashfox.present({review:"accept",frameNonce:<returned frameNonce>})',
      reject:
        'await window.ashfox.present({review:"reject",frameNonce:<returned frameNonce>,issues:["silhouette"|"proportion"|"connection"|"clipping"|"focal_detail"|"material"|"pivot"|"motion"|"other"]})',
      contract:
        'next renders the next missing revision-bound view or complete animation cycle and returns verdict "pending". Inspect the rendered frame, then explicitly accept or reject that exact frameNonce. Only an accepted verdict satisfies review; rejection blocks delivery until a project mutation creates a new revision.'
    },
    capture: {
      result:
        'await window.ashfox.capture({kind:"result"})',
      animation:
        'await window.ashfox.capture({kind:"animation",clipId:"idle"})',
      build:
        'await window.ashfox.capture({kind:"build"})',
      contract:
        'Supply only kind and optional animation clipId. ashfox derives camera, background, resolution, timing, and file options from the active revision and canonical capture policy. A build capture replays only authentic committed revisions, holds one final-model camera frame, and reveals entities in their recorded creation order; it never invents missing authoring steps. For a readable showcase recording, commit meaningful primary-mass, silhouette, articulation, focal-detail, material, and motion passes instead of one monolithic model operation. An omitted clipId selects the canonical animation. The result returns file metadata and SHA-256, never raw bytes. Identical active captures share one promise; a different concurrent capture is rejected.'
    },
    deliver: {
      call: 'await window.ashfox.deliver()',
      contract:
        'No export payload is accepted. The project profile is the single authority for target, game version, artifact format, and export options. Delivery rejects mechanical blockers, rejected frames, or unfinished visual reviews and returns artifact metadata plus adaptationCount and adaptations {converted,omitted}. Each adaptation has code, path, and message; it describes artifact lowering and never mutates the canonical project.'
    }
  },
  authoring: {
    project:
      'Start with project.create {name,target?,gameVersion?,density?}. Read compatibility.options or inspect the command schema before choosing a Minecraft version. Target defaults to glb, each Minecraft target has one curated default version, and density defaults to 1. IDs, timestamps, namespace, and model path are derived. Use density 2 or 4 for smaller surface pixels before adding geometry.',
    intent:
      'Set project.intent.set {subject,forward?,grounding?,features?}. Each call replaces the intent; omitted values become north, free, and []. For any asset with limbs, wheels, tracks, a head, or another directional body plan, explicitly set forward before authoring geometry and treat it as binding. Features are short visual review criteria, not entity IDs.',
    coordinates:
      'Author integer lattice coordinates in project space: +x east, +y up, +z south. At density d, one lattice unit is 1/d model unit. Plate outline points alone are relative to their project-space origin.',
    hierarchy:
      'The project has exactly one root. A lone initial part becomes it; an initial multi-part batch marks one root with parentPartId:null. A later fixed child may omit parentPartId only when exactly one touching parent is unambiguous. Feature, hinge, and ball parts name their parent. ashfox derives shallow snap, shared-face anchor, pivot, seam ownership, bones, cuboids, UVs, and texture pixels.',
    parts: {
      mass: 'Blocky or rounded volume: center, radii, optional profile.',
      segment:
        'Tapered sweep: 2-8 points. One radii triple broadcasts to all points; otherwise provide one triple per point.',
      plate:
        'Extruded surface: plane, origin, thickness, and either rectangle size or one ordered triangle/trapezoid/rectangle outline.',
      radial:
        'Axis-aligned disk or ring: center, axis, outer radius, optional inner radius, depth.',
      feature:
        'The only valid eye representation is a zero-depth marking: parentPartId, motif:"eye", face, anchor, and size of at least [4,3]. Its direct parent must be a deep mass or segment that visibly forms the face: normal-axis span at least 4 lattice cells and at least half the smaller face span. That host must itself attach to a meaningful second volumetric cranium, body, or display housing; the support bounding volume must be at least 10% of the host and its smallest span at least half the host depth, so a token tab cannot pass. Put the marking on the host’s outermost face and leave at least one lattice cell of visible anatomy around every edge after engine-derived attachment placement. A standalone face volume, full-face paint, plate, radial, detached mask, billboard, or thin overlay cannot satisfy eye count. materialId is the contrasting iris base color. ashfox derives the outline, pupil, highlight, parent-surface projection, and UV pixels. Delivered demo assets must keep the pupil center unobstructed, at least 75% of every motif visible, and clear color contrast with the host; anonymously named teeth, ornaments, masks, or other geometry still count as blockers. Geometry part IDs describing eyes, irises, pupils, or glints are rejected. Every later model.parts.upsert re-audits all existing eyes, so flattening or detaching a host is rejected even when the eye itself is not edited.'
    },
    joints:
      'Omit joint for rigid attachment. A hinge rotates around one declared axis; a ball joint rotates around XYZ. Attachment coordinates and pivots are never authored.',
    materials:
      'A new part names materialId and defines an unknown ID once in optional materials [{id,baseColor}]. model.parts.material accepts materialId, baseColor, or both; baseColor alone derives or reuses an ID, and recoloring part of a shared material forks it. ashfox derives tonal pixels, equal square surface pixels, UV gutters, raster, and atlas size.',
    mutations:
      'model.parts.upsert is a same-kind patch: every omitted field on an existing part is preserved. A kind change must provide a complete new shape. Use material for palette edits, transform {rootPartId,by} for a subtree move, mirror {rootPartId,axis,plane} for reflection, and delete for removal. Inspect affected parts after structural edits.'
  },
  animation: {
    command:
      'Use animation.motion.upsert {clipId,role?,durationFrames?,static?,poses?,spins?,removePartIds?}. A new clip requires role and durationFrames. It derives seconds, names, bone/channel/key IDs, canonical 20 FPS sampling, interpolation, shortest rotation paths, and final loop closure.',
    idle:
      'Every animation-capable target needs clipId "idle" with role "idle". Use durationFrames:20 and static:true for an intentional motionless idle; otherwise provide actual closed pose motion. Static delivery profiles omit clips from the artifact but preserve them in the canonical project.',
    poses:
      'poses is an ordered list of {rotations:{partId:angleOrXYZ}}. Use a scalar for a hinge and [x,y,z] degrees for root or ball joints. Every referenced part must appear in the first pose; later omissions carry its previous submitted rotation forward. Name every part that should move; no counterpart motion is invented.',
    spins:
      'Use spins [{partId,turns,direction?}] for continuous hinge rotation. Loop spins require whole turns and safe 20 FPS sampling. Idle cannot contain a spin.',
    patch:
      'Inspect the clip first. On an existing canonical 20 FPS clip, omit role and durationFrames to preserve its name, loop mode, duration, FPS, channel timing, and trigger timing. Supplying role changes the whole clip role; supplying durationFrames retimes the whole clip at 20 FPS and atomically rejects any preserved key or trigger that would land between frames. Omitted part tracks remain, and only removePartIds deletes them. A non-static result must contain actual movement; fixed children cannot be animated.',
    review:
      'Inspect the clip after writing it. present next observes a full required cycle, then accept or reject the returned frameNonce.'
  },
  quality: {
    required:
      'A complete asset has intentional geometry and generated texture coverage. Animation-capable targets also require canonical idle. A static profile may retain canonical clips for later animated delivery. Part count is never a quality target.',
    structure:
      'Prioritize a recognizable silhouette, correct anatomy or construction, believable proportions, connected major masses, readable focal features, and useful articulation before small detail.',
    fidelity:
      'Follow the requested subject rather than substituting a generic humanoid or generic vehicle. For creatures, preserve body plan, limb placement, head-to-body relationship, posture, and defining anatomy. Resolve intent.forward into the project-space forward vector before placing limbs. For every planted limb, trace hip or shoulder to knee or elbow to ankle or wrist to foot to toe; the foot center and the forward tip of every ordinary toe or claw must both advance along that vector, and left/right counterparts must have matching forward reach. A rear-facing toe, dewclaw, or species exception must be visibly intentional, never an accidental front/rear mirror. Represent each visible eye with exactly one feature on a deep face host connected to a second cranial or housing volume. Semantic eye count alone is not proof of a valid face: the delivered pupil center must remain unobstructed, most of the motif must remain visible, and the iris must contrast with its host. A root-only eye host, shallow host, full-face marking, occluding ornament, iris, pupil, highlight, glint, eyeball, socket cube, face plate, or billboard fails the modeling contract.',
    review:
      'Machine checks prove structure and export compatibility, not identity or appeal. Before acceptance, inspect front, side, top, and three-quarter views. In side and top views, verify every foot and toe against intent.forward; in front and three-quarter views, verify that eyes remain embedded in the moving head, visibly contrasting, and free of teeth, masks, or ornaments across the pupil center. Reject reversed feet, accidental forward-axis mirrors, detached or occluded eye surfaces, missing defining parts, floating pieces, swallowed geometry, accidental symmetry, unintended clipping, bad pivots, loop snaps, and details unreadable at gameplay distance.'
  },
  workflow: [
    {
      stage: 'start',
      instruction:
        'Inspect. Submit an operation nextAction directly. For a command nextAction, inspect its schema and provide the project-specific payload. An empty workbench starts with project.create {name,target,gameVersion?,density}; gameVersion is only for a supported Minecraft target.'
    },
    {
      stage: 'plan',
      instruction:
        'Replace project intent with the literal subject, explicit forward direction, grounding, and a short defining-feature plan. Resolve that direction to the coordinate system and choose the correct body or construction plan before coordinates.'
    },
    {
      stage: 'model',
      instruction:
        'Commit primary masses, defining silhouette, articulation, focal anatomy, and surface detail as visible passes; never fabricate build history. Build limbs proximal-to-distal and verify feet and toes advance along intent.forward before mirroring. Attach each eye host to deep cranial or housing anatomy. Keep bounded contrasting eyes inset by one cell, pupil centers clear, and 75% of motifs visible. Reject root-only eye hosts. Fix silhouette, proportions, and joins before detail.'
    },
    {
      stage: 'animate',
      instruction:
        'For an animation-capable target, create canonical idle with animation.motion.upsert, then requested loops or one-shots from ordered poses or hinge spins. Skip this stage when inspect reports a static target.'
    },
    {
      stage: 'review',
      instruction:
        'Call present({review:"next"}), inspect the actual render, and accept or reject its frameNonce. Revise every rejection. After acceptance, optionally capture a result image, animation, or recorded build.'
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
      'Inspect the first blocker. Submit an operation nextAction directly, or inspect a command nextAction before supplying its payload. A failed atomic request changed nothing.',
    concurrent:
      'Wait for the current promise to settle. Do not prepare project revisions manually.',
    visual:
      'If the rendered subject is wrong despite valid structure, revise the part plan rather than adding filler detail.'
  },
  domBridge: {
    purpose:
      'Fallback transport when window.ashfox is unavailable. It forwards inspect, run, present, capture, or deliver and owns no project mutation.',
    request:
      '{"requestId":"unique-id","method":"inspect|run|present|capture|deliver","payload":"optional for inspect, required for run/present/capture, omitted for deliver"}',
    response:
      '{"requestId":"same-unique-id","result":{"ok":true|false,"revision":"..."}}',
    examples: {
      inspect:
        '{"requestId":"inspect-1","method":"inspect","payload":{"kind":"target"}}',
      run:
        '{"requestId":"run-1","method":"run","payload":{"operations":[{"name":"project.create","payload":{"name":"My asset"}}]}}',
      present:
        '{"requestId":"present-1","method":"present","payload":{"review":"next"}}',
      capture:
        '{"requestId":"capture-1","method":"capture","payload":{"kind":"result"}}',
      deliver:
        '{"requestId":"deliver-1","method":"deliver"}'
    },
    input: {
      selector: '[data-agent-command-port-input]',
      property: 'value',
      write:
        'Assign the serialized request JSON to element.value, then dispatch one bubbling input event. The data-agent-command-port-input attribute is only the selector marker.',
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
    adaptationReceipt:
      'A successful deliver result includes adaptationCount and complete adaptations.converted and adaptations.omitted arrays. Treat omitted items as absent only from that artifact; do not delete their source data.',
    rule:
      'After capture or deliver succeeds, transfer the prepared artifact through the connected browser, verify the actual file, and report its workspace-relative path and format. API responses contain metadata only; never copy encoded file bytes through model context.'
  },
  commands
} as const;
