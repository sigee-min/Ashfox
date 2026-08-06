import {
  exportCompatibilityOptions,
  listAgentCommandDefinitions
} from '@ashfox/engine-core';

import {
  agentCommandProtocol
} from './agentCommandProtocol';
import { canonicalFingerprint } from '../../application/canonicalFingerprint';

const commands = listAgentCommandDefinitions().map((definition) => ({
  name: definition.name,
  purpose: definition.purpose,
  schemaHash: canonicalFingerprint(definition.inputSchema)
}));

const compatibility = exportCompatibilityOptions();

export const agentManifest = {
  protocol: agentCommandProtocol.protocol,
  workbench: agentCommandProtocol.workbench,
  href: agentCommandProtocol.href,
  description:
    'Canonical machine guide for routing, creating, reviewing, and exporting one archetype-led iconic Minecraft-style asset with ashfox.',
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
        'window.ashfox.inspect() returns the active operation, revision, stage, first blocker, up to three nextActions, compact authoring authority, counts, diagnostic form composition, export target, and remaining reviews. Cuboid counts reveal compiler fragmentation; they are not artistic budgets. An operation action is ready to submit; a command action requires its current schema and project-specific payload.',
      command:
        'window.ashfox.inspect({kind:"command",name:"<command>"}) returns the exact current input schema. Read it immediately before using an unfamiliar command.',
      parts:
        'window.ashfox.inspect({kind:"parts",ids:["<partId>"]}) returns authorable project-space specs. Reapplying an unchanged inspected spec is a visual no-op.',
      clip:
        'window.ashfox.inspect({kind:"clip",id:"<clipId>"}) returns paged authoring track summaries. Add trackId to page through exact keys for one track; follow nextCursor and never infer omitted keys.',
      catalog:
        'Use kind authoring without id for archetypes, specialist facets/capabilities, attachment ports, claims, compatibility, slot progress, and non-authoritative recipe examples; use an exact authority or recipe ID for detail. Recipes never decide compatibility, readiness, review checks, or commands. Use catalog for part/texture/clip IDs, target for readiness/artifacts, finding for one blocker, and activity for receipts.'
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
      preview:
        'await window.ashfox.present({review:"preview",milestone:"archetype"|"specialists",camera?:"perspective"|"native"|"front"|"side"|"top"})',
      accept:
        'await window.ashfox.present({review:"accept",frameNonce:<returned frameNonce>,checkIds:[...returned reviewChecks ids]})',
      reject:
        'await window.ashfox.present({review:"reject",frameNonce:<returned frameNonce>,issues:["silhouette"|"proportion"|"connection"|"clipping"|"focal_detail"|"material"|"pivot"|"motion"|"other"],failedCheckIds:[...failed returned reviewChecks ids]})',
      contract:
        'preview records milestone evidence but not the delivery ledger; next renders one missing revision-bound view or cycle. Pending results bind purpose, frameNonce, and reviewChecks recalculated from current authority; each check carries facets, its archetype/specialist reference, current evidenceCriteria, and matching criterionId claims. Accept sends every check ID. Reject names failed returned IDs and matching issues. Stale frames and mismatches fail. Only accepted delivery frames complete review; rejection requires a new revision.'
    },
    capture: {
      result:
        'await window.ashfox.capture({kind:"result"})',
      animation:
        'await window.ashfox.capture({kind:"animation",clipId:"idle"})',
      build:
        'await window.ashfox.capture({kind:"build"})',
      contract:
        'Supply kind and optional clipId only. ashfox derives camera, background, resolution, timing, and files from the active revision. Build capture replays authentic commits in entity creation order and never invents authoring. Commit meaningful mass, silhouette, articulation, focal, material, and motion passes for readable playback. Omitted clipId selects the canonical animation. Results return metadata and SHA-256, never raw bytes. Identical captures share a promise; different concurrent capture is rejected.'
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
      'Iconic pixel is the only style. Author semantic cuboid forms on a 1-unit lattice; geometry must change silhouette, depth, articulation, or a defining shape. formComposition is diagnostic, never an artistic cube budget. Pixel variation belongs to system-generated surface clusters and noise, not detail cubes or painted texels. There is no style escape hatch.',
    intent:
      'Set project.intent.set {subject,forward?,grounding?,features?,references?}. References are visible observations {id,kind,description,cues,contentHash?} from supplied images, text, or models. Each call replaces intent. For any directional body plan, explicitly set forward before geometry. Features and cues are visual criteria, not entity IDs.',
    authority:
      'After intent, inspect {kind:"authoring"}; choose one broad archetype and compatible specialists, then use project.authoring.configure. Cover every selected authority evidenceCriterion with an owned criterionId, basis:"observed"|"requested", referenceIds, and rationale. Observed IDs cite current references; requested IDs cite intent.subject or intent.features.N. Plan archetype slots; optional slots require a reason. Bind contributions to an attachment port with {type,contributionId,portId,hostSlotId,partIds}; motion uses {type,specialist,clipId,role}.',
    recipes:
      'Authoring recipes are non-authoritative discovery examples. Criterion-specific claim, slot, and binding suggestions still require current definition and schema inspection. Compatibility, readiness, review checks, and command enforcement derive only from the configured profile and document, never from a recipe.',
    coordinates:
      'Author integer lattice coordinates in project space: +x east, +y up, +z south. In iconic projects one lattice unit is one model unit. Plate outline points alone are relative to their project-space origin.',
    hierarchy:
      'A project has one root: a lone initial part, or one parentPartId:null in an initial batch. A later fixed child may omit parent only when one touching parent is unambiguous; feature, hinge, and ball parts name it. ashfox rederives model-scale parent contact, anchors, pivots, seams, and direct semantic cuboids. partId is the semantic tree label; generated cubes are implementation detail.',
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
        'A feature is a zero-depth mark on one exposed mass or segment face; Ashfox projects anchor to a valid host. Use eye glyph dot|square|slit, nose dot|snout, or mouth neutral|fang|beak. Eyes derive outline/iris/pupil without gloss, eyeball, socket cube, face plate, or billboard. Use motif:"patch" for color-only regions without glyphs or pixel maps; Ashfox supplies tone and automatic noise. Geometry IDs describing eyes, irises, pupils, or glints are rejected.'
    },
    joints:
      'Omit joint for rigid attachment. A hinge rotates around one declared axis; a ball joint rotates around XYZ. Attachment coordinates and pivots are never authored.',
    materials:
      'A new part names materialId and may define it once in materials [{id,baseColor}]. model.parts.material accepts either or both; baseColor alone derives/reuses an ID, and partial recolor forks shared material. Choose role colors and semantic regions, not individual pixels. Ashfox owns three-tone clusters, clustered automatic noise, directional tone, equal square surface pixels, cross-cuboid continuity, UV gutters, raster, and atlas. Automatic noise is required synthesis.',
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
      'Inspect first. On an existing 20 FPS clip, omit role and durationFrames to preserve clip and key timing. role changes the whole clip; durationFrames retimes it and rejects off-frame preserved keys/triggers. Omitted tracks remain; only removePartIds deletes them. Non-static results must move, and fixed children cannot animate.',
    review:
      'Inspect the clip after writing it. present next observes a full required cycle; accept with every returned review check ID or reject with the failed returned check IDs for that frameNonce.'
  },
  quality: {
    required:
      'A complete asset has intentional semantic geometry and system-generated texture coverage. No absolute cuboid count proves quality: prefer the least geometry that preserves silhouette, depth, articulation, and identity, while allowing complexity when those meanings require it. Animation-capable targets also require canonical idle. A static profile may retain canonical clips for later animated delivery.',
    structure:
      'Prioritize silhouette, anatomy/construction, proportions, connected masses, focal features, and articulation. Geometry must change silhouette, depth, articulation, or a named defining shape. Put color-only cues in surface features; delete filler, bevel stairs, scale cubes, and invisible ribs. Never replace Ashfox automatic surface noise.',
    fidelity:
      'Follow configured archetype slots, specialist contributions, and bindings instead of a generic substitute. Preserve body plan, proportions, posture, and defining cues before detail. Resolve intent.forward before directional geometry. Faces use compact unobstructed surface glyphs; gloss, eyeballs, sockets, layered faces, and decorative micro-cubes fail.',
    review:
      'Machine checks prove structure and export compatibility, not recognizability or appeal. Inspect front, side, top, three-quarter, and native gameplay-size views. Squint-test silhouette and face. Reject reversed feet, forward-axis mirrors, occluded glyphs, missing or floating parts, swallowed geometry, accidental symmetry, clipping, bad pivots, loop snaps, micro-noise, and close-up-only detail.'
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
        'Replace project intent with the literal subject, forward direction, grounding, defining features, and normalized reference observations. Inspect broad archetypes and specialist contracts, then submit project.authoring.configure with authority-scoped observed/requested claims, compatible specialists, attachment bindings, and stable part IDs for every required semantic slot before coordinates.'
    },
    {
      stage: 'model',
      instruction:
        'Commit archetype slots first with profile:"block" for major masses. Correct missing, invalid, unassigned, or unbound contributions. Preview milestone "archetype" before specialist contributions and "specialists" after attachment bindings and defining cues. Staged receipts are evidence only, never final delivery review.'
    },
    {
      stage: 'animate',
      instruction:
        'For an animation-capable target, create canonical idle with animation.motion.upsert, then requested loops or one-shots from ordered poses or hinge spins. Skip this stage when inspect reports a static target.'
    },
    {
      stage: 'review',
      instruction:
        'Call present({review:"next"}), inspect the actual render against every returned reviewCheck, then accept with the complete checkIds or reject with issues and the failedCheckIds subset for that exact frameNonce. Revise every rejection. After all delivery-purpose views are accepted, optionally capture a result image, animation, or recorded build.'
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
      'If the rendered subject is wrong despite valid structure, follow the returned reviewChecks and revise proportions, authority claims, slot assignment, attachment binding, or defining cues rather than adding filler detail.'
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
