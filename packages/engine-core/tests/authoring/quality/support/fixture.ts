import type { AuthoringProfile } from '../../../../src/authoring/contract';
import { evaluateSupportQuality } from '../../../../src/authoring/quality/support';
import { materializeIntentProgram } from '../../../../src/compiler/program/materialize';
import type { ProjectDocument } from '../../../../src/model';
import { createProjectDocument } from '../../../../src/project/create';
import {
  parseIntentProgram,
  type IntentProgramModule,
  type IntentProgramSupport
} from '../../../../src/project/program';
import { intentProgramSource } from '../../../program/source';

const source = (
  name: string,
  support: IntentProgramSupport,
  body: readonly IntentProgramModule[]
): string => intentProgramSource({
  name,
  track: 'essential',
  domain: 'constructed',
  forward: 'north',
  symmetry: 'bilateral',
  support,
  body,
  face: { kind: 'none' },
  idle: { mode: 'still' },
  appearance: {
    palette: 'metal',
    texture: {
      kind: 'brushed', scale: 'medium', density: 'sparse', contrast: 'subtle'
    },
    seed: { kind: 'auto' },
    markings: []
  }
});

const programs = {
  base: source('Support base fixture', { kind: 'base', contacts: ['chassis'] }, [
    { id: 'chassis', kind: 'core', cardinality: 'single' },
    {
      id: 'cargo', kind: 'mass', cardinality: 'single', parent: 'chassis',
      anchor: 'front', growth: 'forward', lane: 'center'
    }
  ]),
  foot: source('Support foot fixture', { kind: 'feet', contacts: ['legs'] }, [
    { id: 'torso', kind: 'core', cardinality: 'single' },
    {
      id: 'legs', kind: 'limb', cardinality: 'paired', parent: 'torso',
      anchor: 'sides', growth: 'down', lane: 'center'
    }
  ]),
  wheel: source('Support wheel fixture', { kind: 'wheels', contacts: ['wheels'] }, [
    { id: 'chassis', kind: 'core', cardinality: 'single' },
    {
      id: 'wheels', kind: 'wheel', cardinality: 'paired', parent: 'chassis',
      anchor: 'sides', growth: 'down', lane: 'center'
    }
  ])
} as const;

export interface SupportFixture {
  readonly document: ProjectDocument;
  readonly profile: AuthoringProfile;
}

const materialize = (kind: keyof typeof programs): SupportFixture => {
  const program = programs[kind];
  const parsed = parseIntentProgram(program);
  const errors = parsed.diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error'
  );
  if (!parsed.hash || errors.length > 0) {
    throw new Error(errors.map((diagnostic) => diagnostic.message).join('\n'));
  }
  const result = materializeIntentProgram(createProjectDocument({
    id: `support-quality-${kind}`,
    name: `Support quality ${kind}`,
    revision: 'revision-1',
    createdAt: '2026-08-09T00:00:00.000Z'
  }), { source: program, hash: parsed.hash });
  if (!result.ok) throw new Error(result.error.message);
  if (!result.document.authoringProfile) {
    throw new Error(`Support ${kind} fixture has no authoring profile.`);
  }
  return {
    document: result.document,
    profile: result.document.authoringProfile
  };
};

export const supportFixtures = {
  base: materialize('base'),
  foot: materialize('foot'),
  wheel: materialize('wheel')
} as const;

export const evaluateFixture = ({ document, profile }: SupportFixture) =>
  evaluateSupportQuality(document, profile);
