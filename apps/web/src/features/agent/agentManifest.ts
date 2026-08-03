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
    'Canonical machine guide for creating, reviewing, capturing, and exporting one system-styled iconic pixel asset with ashfox.',
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
        'window.ashfox.inspect() returns the active operation, current revision, stage, first blocker, up to three bounded nextActions, counts, diagnostic form composition, canonical export target, and remaining visual reviews. Compiled and cell-scale cuboid counts reveal accidental compiler fragmentation; they are not artistic budgets or quality scores. An operation action is ready to submit; a command action requires its current schema and project-specific payload.',
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
      'Start with project.create {name,target?,gameVersion?,density?}. Read compatibility.options or inspect the command schema before choosing a Minecraft version. Target defaults to glb, each Minecraft target has one curated default version, and density is fixed to 1. IDs, timestamps, namespace, and model path are derived. Never simulate texture detail with density 2 or 4 geometry.',
    iconic:
      'Iconic pixel is the only new-authoring style. Author semantic cuboid forms on a 1-unit lattice and spend geometry only where it changes silhouette, depth, articulation, or an identity-defining shape. There is no numeric artistic cube ceiling: formComposition is diagnostic, not a pass/fail budget. Pixel variation belongs to deterministic system-generated surface clusters and noise, never anonymous detail cubes or agent-painted texels. There is no style escape hatch in the authoring API.',
    intent:
      'Set project.intent.set {subject,forward?,grounding?,features?}. Each call replaces the intent; omitted values become north, free, and []. For any asset with limbs, wheels, tracks, a head, or another directional body plan, explicitly set forward before authoring geometry and treat it as binding. Features are short visual review criteria, not entity IDs.',
    coordinates:
      'Author integer lattice coordinates in project space: +x east, +y up, +z south. In iconic projects one lattice unit is one model unit. Plate outline points alone are relative to their project-space origin.',
    hierarchy:
      'The project has exactly one root. A lone initial part becomes it; an initial multi-part batch marks one root with parentPartId:null. A later fixed child may omit parentPartId only when exactly one touching parent is unambiguous. Feature, hinge, and ball parts name their parent. ashfox rederives model-scale parent contact, shared-face anchors, pivots, seam ownership, and direct semantic cuboids. Treat partId as the semantic scene-tree label; generated cube nodes are implementation detail.',
    parts: {
      mass:
        'Primary semantic volume: center, radii, optional profile. profile:"block" is the default and should carry the torso, head, pelvis, wheel housing, or other major read. Use soft, balanced, or hard only when the rounded contour materially changes the silhouette.',
      segment:
        'Semantic span chain: 2-8 control points. A straight constant-thickness span emits one cuboid; bends and meaningful taper transitions add short intentional steps. One radii triple broadcasts to all points; otherwise provide one triple per point.',
      plate:
        'Stepped silhouette surface: plane, origin, thickness, and either rectangle size or one ordered triangle/trapezoid/rectangle outline. Sharp outline turns receive narrow silhouette accents instead of dense raster stairs.',
      radial:
        'Axis-aligned disk or ring: center, axis, outer radius, optional inner radius, depth. Radius changes proportion; the compiler keeps a small disk/ring template rather than sampling a curve.',
      feature:
        'A feature is a zero-depth semantic marking on one exposed mass or segment face; anchor is a preferred location that Ashfox projects to the nearest valid host rectangle. Use motif:"eye" with glyph:"dot"|"square"|"slit", motif:"nose" with glyph:"dot"|"snout", or motif:"mouth" with glyph:"neutral"|"fang"|"beak". New focal motifs receive deterministic compact defaults and flat role pixels; an eye derives outline/iris/pupil roles without ellipse, gloss, highlight, eyeball, socket cube, face plate, or billboard. Use motif:"patch" for color-only identity regions such as a belly, muzzle, stripe block, panel, or marking, with no glyph or pixel map. Ashfox fills patches with its deterministic palette cluster, directional tone, and automatic noise. Geometry part IDs describing eyes, irises, pupils, or glints are rejected.'
    },
    joints:
      'Omit joint for rigid attachment. A hinge rotates around one declared axis; a ball joint rotates around XYZ. Attachment coordinates and pivots are never authored.',
    materials:
      'A new part names materialId and defines an unknown ID once in optional materials [{id,baseColor}]. model.parts.material accepts materialId, baseColor, or both; baseColor alone derives or reuses an ID, and recoloring part of a shared material forks it. The agent chooses role-based base colors and semantic feature regions, not individual pixels, shades, or noise. Ashfox owns the deterministic three-tone palette clusters, clustered automatic noise, face-direction tones, equal square surface pixels, continuity across compiled cuboids, UV gutters, raster, and atlas size. Automatic texture noise is required visual synthesis, not disposable detail.',
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
      'A complete asset has intentional semantic geometry and system-generated texture coverage. No absolute cuboid count proves quality: prefer the least geometry that preserves silhouette, depth, articulation, and identity, while allowing complexity when those meanings require it. Animation-capable targets also require canonical idle. A static profile may retain canonical clips for later animated delivery.',
    structure:
      'Prioritize a recognizable silhouette, correct anatomy or construction, believable proportions, connected major masses, readable focal features, and useful articulation. Every geometry part must change silhouette, depth, articulation, or a named identity shape. Put color-only information in semantic surface features; delete filler, bevel-like stair steps, repeated scale cubes, and ribs that disappear at gameplay distance. Never remove or replace Ashfox automatic surface noise—it is the renderer’s pixel-painting layer.',
    fidelity:
      'Follow the requested subject rather than substituting a generic humanoid or generic vehicle. Preserve body plan, limb placement, head-to-body relationship, posture, and two or three defining cues before any secondary detail. Resolve intent.forward into the project-space forward vector before placing limbs. Represent each visible eye with exactly one compact pixel glyph on the owning head or housing volume. Semantic eye count alone is not proof of a readable face: the pupil pixel must remain unobstructed and the glyph must contrast with its host. Gloss, highlights, eyeballs, sockets, and layered eye geometry fail the iconic contract.',
    review:
      'Machine checks prove structure and export compatibility, not identity or appeal. Before acceptance, inspect front, side, top, three-quarter, and native gameplay-size views. Squint-test the silhouette and verify that the face reads before zooming in. Reject reversed feet, accidental forward-axis mirrors, detached or occluded eye glyphs, missing defining parts, floating pieces, swallowed geometry, accidental symmetry, unintended clipping, bad pivots, loop snaps, micro-geometry noise, and details visible only in close-up.'
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
        'Commit primary masses, silhouette, articulation, eye glyphs, and semantic patches as visible passes. Start major masses with profile:"block". Inspect formComposition only to find accidental compiler fragmentation; it is not a target. Build limbs proximal-to-distal, verify feet against intent.forward, then mirror. Fix proportions and joins before assigning surface roles. Describe one compact eye glyph and meaningful color regions; Ashfox synthesizes pixel shades and noise.'
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
      'Inspect the named command schema, correct only the reported path, and submit again. Do not retry with a denser grid or replace semantic surface color with detail geometry.',
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
