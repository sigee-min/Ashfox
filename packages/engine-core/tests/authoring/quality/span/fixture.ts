import type {
  AuthoringProfile,
  AuthoringSlotAssignment
} from '../../../../src/authoring/contract';
import { materializeIntentProgram } from '../../../../src/compiler/program/materialize';
import type { ProjectDocument } from '../../../../src/model';
import { createProjectDocument } from '../../../../src/project/create';
import { parseIntentProgram } from '../../../../src/project/program';
import { intentProgramSource } from '../../../program/source';

const source = intentProgramSource({
  name: 'Forked span quality fixture',
  track: 'essential',
  domain: 'organism',
  forward: 'north',
  symmetry: 'bilateral',
  support: { kind: 'none', contacts: [] },
  body: [{ id: 'torso', kind: 'core', cardinality: 'single' }],
  surfaces: [{
    id: 'tail', role: 'fin', cardinality: 'single', parent: 'torso',
    anchor: 'rear', growth: 'rearward', lane: 'center',
    shape: {
      axis: 'vertical', span: 'long', chord: 'broad', tip: 'forked',
      offset: 'center', edge: 'concave'
    }
  }],
  face: { kind: 'none' },
  idle: { mode: 'still' },
  appearance: {
    palette: 'ocean',
    texture: {
      kind: 'mottle', scale: 'broad', density: 'balanced', contrast: 'subtle'
    },
    seed: { kind: 'auto' },
    markings: []
  }
});

const parsed = parseIntentProgram(source);
const parseErrors = parsed.diagnostics.filter(
  (diagnostic) => diagnostic.severity === 'error'
);
if (!parsed.hash || parseErrors.length > 0) {
  throw new Error(parseErrors.map((diagnostic) => diagnostic.message).join('\n'));
}
const materialized = materializeIntentProgram(createProjectDocument({
  id: 'span-quality-fixture',
  name: 'Span quality fixture',
  revision: 'revision-1',
  createdAt: '2026-08-10T00:00:00.000Z'
}), { source, hash: parsed.hash });
if (!materialized.ok) throw new Error(materialized.error.message);
if (!materialized.document.authoringProfile) {
  throw new Error('Span quality fixture has no authoring profile.');
}
const surfaceSlot = materialized.document.authoringProfile.slots.find(
  (slot) => slot.span.kind === 'supported-surface'
);
if (!surfaceSlot || surfaceSlot.span.kind !== 'supported-surface') {
  throw new Error('Span quality fixture has no supported surface slot.');
}
const supportedSlot = { ...surfaceSlot, span: surfaceSlot.span };

export const deepFreeze = (value: unknown): void => {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return;
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  Object.freeze(value);
};

export interface SpanFixture {
  readonly document: ProjectDocument;
  readonly profile: AuthoringProfile;
  readonly slot: AuthoringSlotAssignment & {
    readonly span: Extract<
      AuthoringSlotAssignment['span'],
      { kind: 'supported-surface' }
    >;
  };
}

deepFreeze(materialized.document);

export const spanFixture: SpanFixture = {
  document: materialized.document,
  profile: materialized.document.authoringProfile,
  slot: supportedSlot
};
