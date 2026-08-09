import {
  exportCompatibilityOptions,
  listAgentCommandDefinitions
} from '@ashfox/engine-core';

import { canonicalFingerprint } from '../../application/canonicalFingerprint';
import { agentCommandProtocol } from './agentCommandProtocol';

const commands = listAgentCommandDefinitions().map((definition) => ({
  name: definition.name,
  purpose: definition.purpose,
  schemaHash: canonicalFingerprint(definition.inputSchema)
}));

const canonicalIntentGrammar = [
  'Every complete source requires: asset "<name>"; track essential|hero; domain organism|constructed; frame front north|south|east|west; symmetry bilateral|asymmetric.',
  'Use rest neutral feet|base|wheels on <body-id>, or rest airborne.',
  'Use body core <id>. Use body mass|chain|radial <id> from <host> extends forward|rearward|up|down|left|right. Use body limb|wheel <id> pair from <host> extends forward|rearward|up|down|left|right.',
  'Use surface <id> pair wing|fin|sail|panel from <body-id> extends lateral|up|forward|rearward, or surface <id> single wing|fin|sail|panel from <body-id> extends left|right|up|forward|rearward.',
  'Use face none, or face full on <body-id> followed by eyes single|pair gaze center, nose present|absent, and mouth absent|neutral|beak|fang.',
  'A full face owns the canonical front: its supported surfaces use lateral, up, or rearward; use a body chain for an anterior form.',
  'Hero track has exactly one focal stage: its full face or focal <id> on <body-id>.',
  'Use motion idle still|breathe|scan and style palette natural|ember|ocean|noir|metal|gold.',
  'Do not use aliases, implicit defaults, coordinates, cubes, materials, pivots, UVs, or keyframes.'
].join(' ');

export const agentManifest = {
  protocol: agentCommandProtocol.protocol,
  workbench: agentCommandProtocol.workbench,
  href: agentCommandProtocol.href,
  description:
    'Machine guide for compiling one intent program into an Ashfox asset and reviewing canonical output.',
  setup: {
    manifest:
      'Fetch this JSON directly. Keep the controlled browser on the workbench.',
    ready:
      'Inspect the active project, then ask exactly: "What would you like to create?" Do not mutate the project before the answer.'
  },
  pageApi: {
    global: 'ashfox',
    inspectMethod: 'inspect',
    runMethod: 'run',
    presentMethod: 'present',
    captureMethod: 'capture',
    inspect: {
      current:
        'window.ashfox.inspect() returns workflow stage, blocker, nextActions, canonical-output readiness, and review state.',
      command:
        'window.ashfox.inspect({kind:"command",name:"<command>"}) returns the exact current schema. Inspect only commands named by nextActions.',
      rule:
        'Do not inspect authoring catalogs, semantic plans, raw parts, clips, or editable geometry. They are compiler internals.'
    },
    run: {
      call:
        'await window.ashfox.run({requestId:"stable-unique-id",operations:[{name:"<command>",payload:{}}]})',
      contract:
        'The only agent-authored asset mutation is intent.program.propose {source:"..."}. Submit it alone, then wait. The user confirms or replaces it in the workbench; the compiler owns all derived project, structure, material, and motion output.'
    },
    present: {
      call: 'await window.ashfox.present({review:"next"})',
      accept:
        'await window.ashfox.present({review:"accept",frameNonce:<frameNonce>,checkIds:[...reviewCheckIds]})',
      reject:
        'await window.ashfox.present({review:"reject",frameNonce:<frameNonce>,issues:[...],failedCheckIds:[...reviewCheckIds]})',
      contract:
        'Review compiled output only. A rejected frame requires a revised intent program, never a part, profile, material, or animation patch.'
    },
    capture: {
      result: 'await window.ashfox.capture({kind:"result"})',
      build: 'await window.ashfox.capture({kind:"build"})'
    }
  },
  authoring: {
    authority:
      'Intent source is the sole modeling authority. AST, normalized IR, semantic contract, layout, PartRecipe, scene, rig, texture, and animations are compiler-owned derived output.',
    program: {
      grammar:
        canonicalIntentGrammar,
      submit:
        'Call intent.program.propose {source} only with one complete program that satisfies this grammar. Source states topology-relevant meaning, not coordinates, cubes, materials, pivots, UVs, or keyframes.'
    },
    tracks: {
      essential:
        'Preserves the same semantic graph with a compact detail budget.',
      hero:
        'Preserves the same semantic graph with additional compiler-derived structure and focal detail. It requires exactly one focal stage: a full face or a named focal declaration. Track never changes subject, support, pose, face, or surface meaning.'
    },
    rules: [
      'After intent.program.propose, stop mutation and wait for user/workbench confirmation and compilation.',
      'To change form, pose, face, support, wings, materials, or motion, revise the source and propose again.',
      'Never omit support host, body direction, full-face host, idle mode, or palette; use only this grammar’s canonical spellings.',
      'Use intent.program.propose as the sole asset-writing command.',
      'Do not infer successful compilation from proposal acceptance; inspect after the workbench reports compilation.'
    ]
  },
  workflow: [
    {
      stage: 'start',
      instruction:
        'If there is no project, ask the user to create one in the workbench. When asked to create or revise an asset, write one complete intent program.'
    },
    {
      stage: 'plan',
      instruction:
        'Submit intent.program.propose {source}, then wait for explicit user confirmation and workbench compilation. Do not send follow-up mutations.'
    },
    {
      stage: 'model',
      instruction:
        'Model is compiler-owned. If the compiled result fails a requirement, revise the intent program and propose it; do not patch derived output.'
    },
    {
      stage: 'animate',
      instruction:
        'Source declares motion idle still, breathe, or scan; the compiler derives the canonical animation. Do not author keyframes, rotations, loops, or one-off motion through the agent surface.'
    },
    {
      stage: 'review',
      instruction:
        'Present compiled frames, accept valid checks, or reject with concrete visual issues. A rejection returns to an intent-program revision.'
    },
    {
      stage: 'deliver',
      instruction: 'After review, tell the user to use Export. The user chooses the target adapter, game version, namespace, and path there; the agent never selects or persists them.'
    }
  ],
  recovery: {
    invalidInput:
      'Correct source syntax or the reported source span, then submit one replacement intent.program.propose.',
    invalidState:
      'Inspect the blocker. If it concerns compiled form, revise source; if it requires user confirmation, wait.',
    visual:
      'Translate the observed issue into intent-program meaning and recompile. Never patch derived geometry.'
  },
  compatibility: {
    options: exportCompatibilityOptions(),
    contract:
      'Target selection affects delivery adaptation only. It never creates a second intent, profile, model, or animation authority.'
  },
  commands
} as const;
