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
    'Canonical machine guide for composing, creating, reviewing, and exporting one structurally authored iconic Minecraft-style asset with ashfox.',
  compatibility: {
    options: compatibility,
    contract:
      'Choose a listed target and gameVersion pair; omit gameVersion for glTF or GLB. Minecraft omission selects that target’s curated default. animationSupport "none" omits artifact clips while keeping the canonical source unchanged; "actor" and "scene" require canonical idle.'
  },
  setup: {
    manifest:
      'Fetch this JSON with a direct system HTTP request such as curl. Do not navigate the controlled browser away from the workbench.',
    browser:
      'Open /workbench/ in an in-app browser, or a connected browser if unavailable.',
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
        'window.ashfox.inspect() returns operation, revision, stage, first blocker, nextActions, structural authority and active quality gate, counts, form composition, target, and reviews. Cuboid counts reveal fragmentation, not artistic budgets. Submit operation actions directly; inspect command schemas.',
      command:
        'window.ashfox.inspect({kind:"command",name:"<command>"}) returns the exact current input schema. Read it immediately before using an unfamiliar command.',
      parts:
        'window.ashfox.inspect({kind:"parts",ids:["<partId>"]}) returns authorable project-space specs. Reapplying an unchanged inspected spec is a visual no-op.',
      clip:
        'window.ashfox.inspect({kind:"clip",id:"<clipId>"}) returns paged authoring track summaries. Add trackId to page through exact keys for one track; follow nextCursor and never infer omitted keys.',
      catalog:
        'Use kind authoring without id for the composable contract, neutral specialists, claims, progress, and recipes. Modules expose structuralRole, qualityStage, partIds, parentSlotIds, spatialRelations, facing, pairId, and contact; assetQuality nests structure, intent coverage, and conditional face gates. Role policies list allowed parts and stages. Recipes never decide commands. Use target for readiness, finding for blockers, and activity for receipts.'
    },
    run: {
      call:
        'await window.ashfox.run({requestId:"stable-unique-id",operations:[{name:"<command>",payload:{}}]})',
      contract:
        'Submit 1-64 atomic operations. The port supplies project and revision. Same-session retries of identical requestId and operations return the same result; changed reuse is rejected.',
      terminal:
        'Every outcome resolves once and releases working state.'
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
        'preview records evidence, not the delivery ledger; next renders one missing view or cycle. Results bind frameNonce and reviewChecks carrying evidenceCriteria and criterionId claims. Accept all check IDs; reject failed IDs and issues. Stale frames fail. Only accepted delivery frames complete review.'
    },
    capture: {
      result:
        'await window.ashfox.capture({kind:"result"})',
      animation:
        'await window.ashfox.capture({kind:"animation",clipId:"idle"})',
      build:
        'await window.ashfox.capture({kind:"build"})',
      contract:
        'Supply kind and optional clipId. Ashfox derives camera, background, resolution, timing, and files. Build replays real commits. Omitted clipId selects canonical animation. Results return metadata and SHA-256, never raw bytes. Concurrent duplicates share a promise.',
    },
    deliver: {
      call: 'await window.ashfox.deliver()',
      contract:
        'No payload is accepted. The project profile owns target, game version, format, and options. Delivery rejects unfinished work and returns artifact metadata, adaptationCount, and {converted,omitted} adaptations. Lowering never mutates the canonical project.'
    }
  },
  authoring: {
    project:
      'Start with project.create {name,target?,gameVersion?,density?}. Read compatibility.options or the schema before choosing a Minecraft version. Target defaults to glb; each Minecraft target has one curated default; density is fixed to 1. IDs and paths are derived. Never simulate texture detail with density 2 or 4 geometry.',
    iconic:
      'Iconic pixel is the only style. On a 1-unit lattice, geometry must change silhouette, depth, articulation, or identity. Preserve identity-bearing middle forms: neck break, muzzle plane, mass rhythm, span fold, joint, foot, or taper. Iconic does not mean childlike, uniform, or fewest parts. formComposition is diagnostic, never an artistic cube budget. Pixel variation belongs to system-generated surface clusters and noise, not detail cubes or painted texels. There is no style escape hatch.',
    intent:
      'Set project.intent.set {subject,forward?,grounding?,features?,references?}. Normalize every requested or observed cue that must survive into one features entry. Each call replaces intent; explicitly set forward before directional geometry.',
    authority:
      'After intent, inspect {kind:"authoring"} and the project.authoring.configure schema. Configure one composable structural authority from neutral module instances; do not select or invent a named body plan. Cover each evidenceCriterion with criterionId, basis:"observed"|"requested", referenceIds, and rationale. Optional modules require identity, silhouette, articulation, or target-format reason. Specialists add bounded policy and motion, never topology.',
    structuralAuthority:
      'The authority is an open module graph. Each slot declares structuralRole, qualityStage, partIds, parentSlotIds, spatialRelations, facing, pairId, and contact through the inspected schema. Compose any number of core, axis, articulated, span, focal-frame, and accent instances. Missing or contradictory landmarks block the next gate.',
    tracks: {
      contract:
        'Tracks are asset-wide representation contracts, never low/high quality. hero is default; face rules are a conditional part.',
      essential:
        'essential deliberately distills the whole asset for explicit cute, chibi, mascot, or icon needs. Silhouette and middle structure remain complete. Targets may be shared; undeclared focal modules are optional.',
      hero:
        'hero is for ambiguity, reference fidelity, terminal forms, and semantic material boundaries. It requires all stages, exclusive feature targets, and multi-view material review.',
      coverage:
        'Map every intent.features.N exactly once with slotIds and materialIds; use geometry, features, or role materials. Automatic noise never counts.'
    },
    face: {
      contract:
        'Set faceMode explicitly; never infer it. A biological face uses full with one focal-frame host, component-exclusive descendant slots, and explicit role materials.',
      tracks:
        'full essential requires readable eye, nasal nose|muzzle|beak, and oral mouth. full hero preserves reference proportions with eye-frame orbital|brow, nasal, oral, and jaw; an open mouth requires mouth-interior.',
      review:
        'At native gameplay size, gaze, mouth state, and expression must read. A lone dot or 1px eye fails; eyes are non-dot and at least 2x2. Keep noise subordinate. Nasal or oral omissions need observed/requested species evidence.'
    },
    motifs: {
      core:
        'Primary load-bearing volume. Split only for meaningful mass rhythm, articulation, or silhouette.',
      axis:
        'Directed serial form such as neck, tail, branch, or boom. Preserve bends and taper; never sample path cells.',
      articulated:
        'Jointed proximal-to-distal chain. Pairing, handedness, forward, and grounded/free contact are explicit.',
      span:
        'Rooted spread such as wing, fin, sail, or panel: segments form spars and plates form membranes; never use a grounded limb.',
      'focal-frame':
        'Host planes for gaze, mouth, controls, or signage. Establish brow, muzzle, bezel, or equivalent before projecting glyphs.',
      accent:
        'Optional silhouette-changing horn, crest, handle, antenna, or blade. Color-only accents are features.'
    },
    recipes:
      'Recipes are non-authoritative discovery examples. Their claim, slot, and binding suggestions require current schema inspection. Compatibility, readiness, review checks, and commands derive from the configured graph and document, never from a recipe.',
    coordinates:
      'Use integer project coordinates: +x east, +y up, +z south. One lattice unit is one model unit. Plate outlines alone are origin-relative.',
    hierarchy:
      'A project has one root: a lone initial part or one parentPartId:null. A fixed child may omit parent only with one unambiguous touching parent; feature and jointed parts name it. Ashfox rederives model-scale parent contact, anchors, pivots, seams, and direct semantic cuboids. partId is semantic; cubes are implementation detail.',
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
      'Omit joint for rigid attachment. A hinge declares one axis; a ball rotates in XYZ. Ashfox derives attachment and pivot.',
    materials:
      'A new part names materialId and may define materials [{id,baseColor}]. model.parts.material accepts either or both; baseColor derives/reuses an ID, and partial recolor forks shared material. Choose role colors and semantic regions, not individual pixels. Ashfox owns three-tone clusters, clustered automatic noise, directional tone, equal square surface pixels, cross-cuboid continuity, UV gutters, raster, and atlas. Automatic noise is required synthesis.',
    mutations:
      'model.parts.upsert preserves omitted fields on same-kind parts; kind changes require a complete shape. Use material for palette, transform {rootPartId,by}, mirror {rootPartId,axis,plane}, and delete. Inspect parts after structural edits.'
  },
  animation: {
    command:
      'Use animation.motion.upsert {clipId,role?,durationFrames?,static?,poses?,spins?,removePartIds?}. New clips require role and durationFrames; Ashfox derives 20 FPS keys, interpolation, shortest paths, and loop closure.',
    idle:
      'Animated targets need clipId "idle" role "idle". Use durationFrames:20 and static:true for motionless idle or a closed pose loop. Static delivery may omit clips but preserve them canonically.',
    poses:
      'poses is ordered {rotations:{partId:angleOrXYZ}}. Hinges use scalars; roots and balls use [x,y,z]. Put every track in the first pose; omissions carry forward. No counterpart motion is invented.',
    spins:
      'Use spins [{partId,turns,direction?}] for continuous hinge rotation. Loop spins require whole turns and safe 20 FPS sampling. Idle cannot contain a spin.',
    patch:
      'Inspect first. Omit role and durationFrames to preserve timing; changing duration validates preserved keys. Omitted tracks remain; only removePartIds deletes them. Non-static clips must move; fixed children cannot.',
    review:
      'Inspect after writing. present next observes one cycle; accept every check ID or reject failed IDs for that frameNonce.'
  },
  quality: {
    required:
      'Complete assets have intentional geometry and generated texture coverage. No absolute cuboid count proves quality: use the least geometry that preserves silhouette, depth, articulation, and identity, with more when meaning requires it. Animated targets need canonical idle; a static profile may retain canonical clips.',
    structure:
      'Prioritize silhouette, construction, proportion, connection, focal features, and articulation. Keep macro and identity-bearing middle forms; remove only unreadable micro-geometry. Before noise, realize every requested or observed cue with explicit geometry, a feature, or a distinct role material. Automatic noise never invents semantic material boundaries. Delete filler, bevel stairs, scale cubes, and hidden ribs.',
    fidelity:
      'Follow the configured module graph, policies, and bindings instead of a generic substitute. Preserve body plan, proportions, posture, maturity, and defining cues. Resolve intent.forward first. Faces use unobstructed surface glyphs on an intentional focal frame; gloss, eyeballs, sockets, layered faces, and decorative micro-cubes fail.',
    gates: {
      silhouette:
        'Gate 1 — macro: establish core proportion, axes, span direction, reach, stance, and negative space. Reject an unreadable silhouette.',
      structure:
        'Gate 2 — meso: verify mass rhythm, roots, folds, joints, contacts, terminal forms, openings, and taper. Reject toy uniformity and fragmentation.',
      focal:
        'Gate 3 — focal: verify host planes, room, separation, direction, and contrast before feature projection. Never add rescue geometry.',
      surface:
        'Gate 4 — surface: after the first three gates, audit cue coverage and role-material boundaries, then synthesize three-tone clusters, UV continuity, and required automatic noise.'
    },
    review:
      'Machine checks do not prove recognizability or appeal. Inspect front, side, top, three-quarter, and native gameplay-size views. Reject unreadable silhouettes or faces, reversed feet, axis mirrors, occlusion, missing or floating parts, clipping, bad pivots, loop snaps, micro-noise, and close-up-only detail.'
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
        'Replace intent with subject, forward, grounding, normalized features, and references. Inspect contracts, then call project.authoring.configure with asset-wide track, conditional face contract, exact feature coverage, claims, and modules declaring role, stage, parts, hierarchy, direction, pair, and contact before coordinates.'
    },
    {
      stage: 'model',
      instruction:
        'Commit the macro pass first with profile:"block" for primary masses, then meso structure and focal frames. Map every requested or observed cue to geometry, a feature, or a distinct role material. Pass macro, meso, and focal before surface synthesis and noise. Use inspected preview milestone names and correct incomplete contributions. Staged receipts are not final review.'
    },
    {
      stage: 'animate',
      instruction:
        'For an animation-capable target, create canonical idle with animation.motion.upsert, then requested loops or one-shots from ordered poses or hinge spins. Skip this stage when inspect reports a static target.'
    },
    {
      stage: 'review',
      instruction:
        'Call present({review:"next"}), inspect the render at native size against every returned reviewCheck, then accept all checkIds or reject with issues and failedCheckIds for that frameNonce. Revise every rejection. After all delivery views pass, optionally capture a result, animation, or build.'
    },
    {
      stage: 'deliver',
      instruction:
        'Call deliver() only when mechanically ready and visually reviewed. Transfer the prepared artifact without copying bytes through model context.'
    }
  ],
  recovery: {
    invalidInput:
      'Inspect the command schema, correct the reported path, and resubmit. Never replace surface color with dense geometry.',
    invalidState:
      'Inspect the first blocker. Submit operation nextActions directly; inspect command nextActions before payloads. Failed atomic requests change nothing.',
    concurrent:
      'Wait for the current promise. Never prepare revisions manually.',
    visual:
      'If the render is wrong despite valid structure, follow reviewChecks and revise module relations, proportions, claims, or defining cues rather than adding filler detail.'
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
