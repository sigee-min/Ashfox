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
        'asset "name"; track essential|hero; domain organism|constructed; frame front north|south|east|west; symmetry bilateral|asymmetric; rest feet|base|airborne; body core|mass|chain|limb|wheel|radial declarations; supported surfaces; face; optional semantic palette natural|ember|ocean|noir|metal|gold. The compiler supplies canonical idle.',
      submit:
        'Call intent.program.propose {source}. Source must state topology-relevant meaning, not coordinates, cubes, materials, pivots, UVs, or keyframes.'
    },
    tracks: {
      essential:
        'Preserves the same semantic graph with a compact detail budget.',
      hero:
        'Preserves the same semantic graph with additional compiler-derived structure and focal detail. Track never changes subject, support, pose, face, or surface meaning.'
    },
    rules: [
      'After intent.program.propose, stop mutation and wait for user/workbench confirmation and compilation.',
      'To change form, pose, face, support, wings, materials, or motion, revise the source and propose again.',
      'Never call legacy raw mutation or semantic-inspection interfaces.',
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
        'The compiler supplies the canonical neutral idle. Do not author keyframes, rotations, loops, or one-off motion through the agent surface.'
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
