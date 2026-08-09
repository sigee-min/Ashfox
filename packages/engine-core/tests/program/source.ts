import type {
  IntentProgramAppearance,
  IntentProgramDomain,
  IntentProgramFace,
  IntentProgramFocal,
  IntentProgramForwardDirection,
  IntentProgramIdleAnimation,
  IntentProgramModule,
  IntentProgramSupport,
  IntentProgramSurface,
  IntentProgramSymmetry,
  IntentProgramTrack
} from '../../src/project/program/types';

export interface IntentProgramSourceFixture {
  readonly name: string;
  readonly track: IntentProgramTrack;
  readonly domain: IntentProgramDomain;
  readonly forward: IntentProgramForwardDirection;
  readonly symmetry: IntentProgramSymmetry;
  readonly support: IntentProgramSupport;
  readonly body: readonly IntentProgramModule[];
  readonly surfaces?: readonly IntentProgramSurface[];
  readonly face: IntentProgramFace;
  readonly focal?: IntentProgramFocal;
  readonly idle: IntentProgramIdleAnimation;
  readonly appearance: Omit<IntentProgramAppearance, 'version'>;
}

const bodyLine = (module: IntentProgramModule): string =>
  module.kind === 'core'
    ? `    core ${module.id}`
    : `    ${module.kind} ${module.id} ${module.cardinality} ` +
      `parent ${module.parent} anchor ${module.anchor} growth ${module.growth} ` +
      `lane ${module.lane}`;

const surfaceLine = (surface: IntentProgramSurface): string =>
  `  surface ${surface.id} ${surface.cardinality} ${surface.role} ` +
  `parent ${surface.parent} anchor ${surface.anchor} growth ${surface.growth} ` +
  `lane ${surface.lane}`;

const shapeLines = (surface: IntentProgramSurface): readonly string[] => {
  if (!surface.shape) return [];
  const shape = surface.shape;
  return [
    `  shape ${surface.id} {`,
    `    axis ${shape.axis}`,
    `    span ${shape.span}`,
    `    chord ${shape.chord}`,
    `    tip ${shape.tip}`,
    `    offset ${shape.offset}`,
    `    edge ${shape.edge}`,
    '  }'
  ];
};

const faceLines = (face: IntentProgramFace): readonly string[] => {
  if (face.kind === 'none') return ['  face {', '    none', '  }'];
  return [
    '  face {',
    `    full parent ${face.parent}`,
    `    eyes ${face.eyes} gaze ${face.gaze}`,
    `    nose ${face.nose}`,
    `    mouth ${face.mouth}`,
    '  }'
  ];
};

const supportLine = (support: IntentProgramSupport): string =>
  support.kind === 'none'
    ? '  support none'
    : `  support ${support.kind} contacts ${support.contacts.join(' ')}`;

const markLine = (
  marking: IntentProgramAppearance['markings'][number]
): string => {
  const target = marking.target.kind === 'face'
    ? 'face'
    : `${marking.target.kind} ${marking.target.id}`;
  return [
    `  mark ${marking.id} target ${target}`,
    `region ${marking.region}`,
    `placement ${marking.placement}`,
    `as ${marking.motif}`,
    `tone ${marking.tone}`,
    ...(marking.flow ? [`flow ${marking.flow}`] : []),
    ...(marking.variant ? [`variant ${marking.variant}`] : []),
    `scale ${marking.scale}`,
    `density ${marking.density}`,
    `contrast ${marking.contrast}`
  ].join(' ');
};

/**
 * Emits one explicit Intent Program 1 source with all four authorities.
 * The builder supplies no domain, appearance, support, or animation defaults.
 */
export const intentProgramSource = (
  fixture: IntentProgramSourceFixture
): string => {
  const surfaces = fixture.surfaces ?? [];
  const appearance = fixture.appearance;
  const seed = appearance.seed.kind === 'auto'
    ? 'auto'
    : appearance.seed.value;
  return [
    'metadata {',
    `  name ${JSON.stringify(fixture.name)}`,
    `  track ${fixture.track}`,
    `  domain ${fixture.domain}`,
    '}',
    'model {',
    `  orientation forward ${fixture.forward}`,
    `  symmetry ${fixture.symmetry}`,
    supportLine(fixture.support),
    '  body {',
    ...fixture.body.map(bodyLine),
    '  }',
    ...surfaces.map(surfaceLine),
    ...surfaces.flatMap(shapeLines),
    ...faceLines(fixture.face),
    ...(fixture.focal
      ? [`  focal ${fixture.focal.id} parent ${fixture.focal.parent}`]
      : []),
    '}',
    'animation {',
    `  idle ${fixture.idle.mode}${
      fixture.idle.target ? ` target ${fixture.idle.target}` : ''
    }`,
    '}',
    'appearance {',
    `  palette ${appearance.palette}`,
    `  texture ${appearance.texture.kind} scale ${appearance.texture.scale} ` +
      `density ${appearance.texture.density} ` +
      `contrast ${appearance.texture.contrast}`,
    `  seed ${seed}`,
    ...appearance.markings.map(markLine),
    '}'
  ].join('\n');
};
