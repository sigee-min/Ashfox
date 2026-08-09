import {
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION,
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

const language = INTENT_PROGRAM_LANGUAGE_SPECIFICATION;
const appearance = language.appearance.specification;
const surfaceShapes = language.surfaceShapes;
const supportCompatibility = language.supportCompatibility;
const invariants = language.invariants;
const heroPresentation = invariants.presentationByTrack.hero;
const presentationSlot = invariants.attachmentSlots.presentation.slot;
const singleLateralRule =
  language.symmetryCompatibility.singleLateralAttachment;
const markSchema = appearance.statements.mark;
const seedSchema = appearance.statements.seed;
const seedAutomatic = seedSchema.forms.automatic;
const seedExplicit = seedSchema.forms.explicit;
const flowMotifs =
  markSchema.conditions.flow.allowedWhen.motif;
const alternatives = (values: readonly string[]): string => values.join('|');
const relationAlternatives = (
  tuples: readonly (readonly string[])[]
): string => tuples.map((tuple) => tuple.join(':')).join('|');
const supportContactAlternatives = Object.values(
  supportCompatibility.contactRequirementsByKind
).map((rule) => [
  rule.supportKind,
  rule.moduleKinds.join('|'),
  rule.requiredGrowth ?? 'any'
].join(':')).join('|');
const requiredModuleContacts = supportCompatibility.requiredModuleContacts
  .map((rule) => `${rule.moduleKind}:${rule.supportKind}`)
  .join('|');
const targetReferenceAlternatives = Object.entries(markSchema.targetReferences)
  .map(([target, reference]) => [
    target, reference.namespace, reference.idCardinality
  ].join(':'))
  .join('|');
const languageSpecification = Object.freeze({
  ...language,
  identifier: Object.freeze({
    ...language.identifier,
    pattern: language.identifier.pattern.source
  })
});

const canonicalIntentGrammar = [
  'Intent Program language version is fixed at 1.',
  'Every complete source contains exactly four closed blocks, in any order: metadata, model, animation, and appearance. Root-level declarations are invalid.',
  `Use metadata { name "<name>"; track ${alternatives(language.metadata.tracks)}; domain ${alternatives(language.metadata.domains)} }. Metadata is a closed whole-asset classification authority, never an arbitrary key/value bag. Name normalization is ${invariants.name.normalization}.`,
  `Use model { orientation forward ${alternatives(language.model.forwardDirections)}; symmetry ${alternatives(language.model.symmetries)}; support ...; body { ... }; surface ...; shape ...; face { ... }; optional focal ... }. Model alone owns topology, support contacts, spatial attachment, morphology, surfaces, and focal meaning.`,
  `Under ${singleLateralRule.whenSymmetry} symmetry, ${singleLateralRule.cardinality} ${singleLateralRule.appliesTo.join('|')} attachments on ${singleLateralRule.anchors.join('|')} require ${singleLateralRule.requiredSymmetry}; this rule is published at specification.symmetryCompatibility.singleLateralAttachment. Asymmetric is global ownership, not a ban on local pairs: explicitly paired modules, surfaces, or eyes receive compiler-owned local reflection authority.`,
  `Inside model, use support none, support feet|wheels contacts <body-id>..., or support base contacts <body-id>. Support is contact meaning, never pose or motion. Contact requirements are published at specification.supportCompatibility.contactRequirementsByKind (${supportContactAlternatives}); required module contacts are published at specification.supportCompatibility.requiredModuleContacts (${requiredModuleContacts}).`,
  `Inside model body { ... }, use core <id>, or <kind> <id> <cardinality> parent <body-id> anchor <anchor> growth <growth> lane <lane>. Parent, anchor, growth, and lane are independent typed fields. The exact kind:cardinality:anchor:growth relation tuples are published at specification.relations.moduleTuples (${relationAlternatives(language.relations.moduleTuples)}); valid lanes are published per anchor at specification.relations.lanesByAnchor.`,
  `Inside model, use surface <id> <cardinality> ${alternatives(language.model.surfaceRoles)} parent <body-id> anchor <anchor> growth <growth> lane <lane>. The exact cardinality:anchor:growth relation tuples are published at specification.relations.surfaceTuples (${relationAlternatives(language.relations.surfaceTuples)}); valid lanes use the same lanesByAnchor authority.`,
  `Optionally shape a named surface with shape <surface-id> { axis ${surfaceShapes.axis.join('|')}; span ${surfaceShapes.span.join('|')}; chord ${surfaceShapes.chord.join('|')}; tip ${surfaceShapes.tip.join('|')}; offset ${surfaceShapes.offset.join('|')}; edge ${surfaceShapes.edge.join('|')} }. Every field is required exactly once, field order is irrelevant, and the closed schema rejects unknown or duplicate properties. Axis-growth and axis-offset compatibility are published at specification.surfaceShapes.compatibility.`,
  `Inside model, use face { none }, or face { full parent <body-id>; eyes ${alternatives(language.model.eyeConfigurations)} gaze ${alternatives(language.model.gazeModes)}; nose ${alternatives(language.model.noseModes)}; mouth ${alternatives(language.model.mouthModes)} }.`,
  `A full face claims the ${presentationSlot.anchor}/${presentationSlot.lane} presentation slot; ${invariants.attachmentSlots.presentation.exclusiveClaimKinds.join('|')} claims are exclusive there. Use another typed lane or a body chain instead of competing for that slot.`,
  `Hero track has exactly ${heroPresentation.exactClaimCount} focal stage from ${heroPresentation.claimKinds.join('|')}: a full face or focal <id> parent <body-id>.`,
  `Use animation { idle ${alternatives(language.animation.idleModes)} [target <body-id>] }. Animation alone owns authored motion intent; keyframes remain compiler output.`,
  `Use appearance { palette ${alternatives(language.appearance.palettes)}; texture ${alternatives(appearance.textures)} scale ${alternatives(appearance.scales)} density ${alternatives(appearance.densities)} contrast ${alternatives(appearance.contrasts)}; seed ${seedAutomatic.sentinel}|<${seedExplicit.value.format}>; zero or more mark <id> target ${alternatives(appearance.targets)} ... }. Target reference namespaces and ID cardinalities are published at specification.appearance.specification.statements.mark.targetReferences (${targetReferenceAlternatives}). Every mark then declares region ${alternatives(appearance.regions)}, placement ${alternatives(appearance.placements)}, motif ${alternatives(appearance.motifs)}, tone ${alternatives(appearance.tones)}, scale ${alternatives(appearance.scales)}, density ${alternatives(appearance.densities)}, and contrast ${alternatives(appearance.contrasts)} in the schema order. Mark ${markSchema.identity.field} values are ${markSchema.identity.unique ? 'unique' : 'not unique'}; region and placement overlap is published at specification.appearance.specification.markingOverlap. Optional flow ${alternatives(appearance.flows)} is accepted only for motif ${alternatives(flowMotifs)}; optional variant is lower-kebab-case. Palette, texture, and seed are explicit and declared exactly once; the seed forms are published at specification.appearance.specification.statements.seed.forms.`,
  'Do not use aliases, coordinates, vertices, cubes, materials, pivots, UVs, or keyframes. Omit shape only when the role-compatible canonical default planform is intentional.'
].join(' ');

export const agentManifest = {
  protocol: agentCommandProtocol.protocol,
  workbench: agentCommandProtocol.workbench,
  href: agentCommandProtocol.href,
  description:
    'Machine guide for autonomously compiling one intent program into an Ashfox asset and reviewing canonical output for a human observer.',
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
      intentProgram:
        'Before every proposal, call window.ashfox.inspect({kind:"intent-program",source:"<complete source>"}). Read every diagnostic in returned source order, use each path and span to revise the source, and repeat until valid is true. This lint is read-only and never stages or compiles the project.',
      rule:
        'Do not inspect authoring catalogs, semantic plans, raw parts, clips, or editable geometry. They are compiler internals.'
    },
    run: {
      call:
        'await window.ashfox.run({requestId:"stable-unique-id",operations:[{name:"<command>",payload:{}}]})',
      contract:
        'Agent asset mutations are intent.program.propose {source:"..."} and the exact intent.program.compile operation returned by the next inspect. Submit exactly one operation per call. The Agent—not the human—decides whether to revise or compile; the compiler owns all derived project, structure, material, and motion output.'
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
      'Intent source is the sole modeling authority and is agent-authored from the human’s natural-language prompt. The Agent validates, stages, decides, and compiles. Humans observe the result and may request changes in chat, export, or capture; they never confirm compilation, edit source, or edit raw derived data. AST, normalized IR, semantic contract, layout, PartRecipe, scene, rig, texture, and animations are compiler-owned derived output.',
    program: {
      specification: languageSpecification,
      grammar:
        canonicalIntentGrammar,
      submit:
        'First lint the complete source with inspect({kind:"intent-program",source}), correct all returned diagnostics, and repeat until valid is true. Only then call intent.program.propose {source}. Source states topology-relevant meaning, not coordinates, cubes, materials, pivots, UVs, or keyframes.'
    },
    tracks: {
      essential:
        'Preserves the same semantic graph with a compact detail budget.',
      hero:
        'Preserves the same semantic graph with additional compiler-derived structure and focal detail. It requires exactly one focal stage: a full face or a named focal declaration. Track never changes subject, support, pose, face, or surface meaning.'
    },
    rules: [
      'After intent.program.propose, inspect again. If inspect returns an exact intent.program.compile operation and the staged evidence is acceptable, run that exact operation without asking the human to confirm. Otherwise revise and replace the proposal.',
      'To change form, pose, face, support, wings, materials, or motion, revise the source and propose again.',
      'Express surface richness and local markings only through appearance texture, seed, and semantic mark declarations. Palette and contrast change color projection, while seed and semantic controls own deterministic masks.',
      'Keep metadata, model, animation, and appearance in their closed blocks. Never duplicate an owner or place a declaration in another owner block.',
      'When silhouette matters, use one coordinate-free shape declaration per named surface. Compose named surfaces for dorsal, pectoral, caudal, wing, sail, or panel regions; never request generated vertices or patch membrane parts.',
      'Never omit support contacts, body parent/anchor/growth/lane, full-face parent, idle mode, or palette; use only this grammar’s canonical spellings.',
      'Use intent.program.propose and the inspect-supplied intent.program.compile as the only asset-writing commands; submit each alone.',
      'Lint is mandatory before every proposal: consume all diagnostics in source order and never submit after correcting only the first error.',
      'Keep the human observation-only: never ask the human to confirm compilation or edit Intent Program source, parts, geometry, materials, rig, textures, or keyframes.',
      'Do not infer successful compilation from proposal acceptance; inspect after the workbench reports compilation.'
    ]
  },
  workflow: [
    {
      stage: 'start',
      instruction:
        'If there is no project, ask the user to create one in the workbench. Translate the user’s natural-language creation or revision request into one complete intent program yourself; never ask the user to edit source or derived data.'
    },
    {
      stage: 'plan',
      instruction:
        'Lint the complete source with inspect({kind:"intent-program",source}) until valid, submit intent.program.propose {source}, then inspect again. Decide autonomously whether to revise or run the exact intent.program.compile operation returned by inspect. Never ask the human to approve compilation.'
    },
    {
      stage: 'model',
      instruction:
        'Model is compiler-owned. If the compiled result fails a requirement, revise the intent program and propose it; do not patch derived output.'
    },
    {
      stage: 'animate',
      instruction:
        'The animation block declares idle still, breathe, or scan; the compiler derives the canonical animation. Do not author keyframes, rotations, loops, or one-off motion through the agent surface.'
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
      'Inspect the blocker. If a proposal is staged, either run the exact compile operation returned by inspect or revise the source. Never wait for human confirmation.',
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
