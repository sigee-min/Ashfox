import type {
  IntentProgramFace,
  IntentProgramIr,
  IntentProgramSemanticAst,
  IntentProgramSupport,
  IntentProgramSurface
} from '../types';
import type {
  IntentProgramConstraintInspection,
  IntentProgramConstraintReporter
} from './contract';
import {
  createConstraintState,
  finishConstraintAnalysis,
  type ConstraintAnalysis
} from './analysis';
import {
  validateIntentProgramAppearance,
  validateIntentProgramSymmetry
} from './appearance';
import { validateIntentProgramRelations } from './relations';
import { validateIntentProgramSupport } from './support';
import { validateIntentProgramTargets } from './targets';

const analyzeIntentProgramConstraints = (
  ast: IntentProgramSemanticAst
): ConstraintAnalysis => {
  const state = createConstraintState(ast);
  const graph = validateIntentProgramRelations(state);
  validateIntentProgramTargets(state);
  validateIntentProgramSupport(state);
  const appearance = validateIntentProgramAppearance(state);
  validateIntentProgramSymmetry(state);
  return finishConstraintAnalysis(state, graph, appearance);
};

export const collectIntentProgramConstraintIssues = (
  ast: IntentProgramSemanticAst
): IntentProgramConstraintInspection =>
  analyzeIntentProgramConstraints(ast).inspection;

const normalizeSupport = (
  support: IntentProgramSemanticAst['model']['support'],
  contacts: readonly string[]
): IntentProgramSupport | null => {
  if (!support) return null;
  if (support.kind === 'none') {
    return contacts.length === 0 ? { kind: 'none', contacts: [] } : null;
  }
  const [first, ...rest] = contacts;
  if (!first) return null;
  if (support.kind === 'base') {
    return rest.length === 0 ? { kind: 'base', contacts: [first] } : null;
  }
  return { kind: support.kind, contacts: [first, ...rest] };
};

const normalizeFace = (
  face: IntentProgramSemanticAst['model']['face']
): IntentProgramFace | null => {
  if (!face) return null;
  if (face.kind === 'none') return face;
  if (!face.eyes || !face.gaze || !face.nose || !face.mouth) return null;
  return {
    kind: 'full', parent: face.parent, eyes: face.eyes, gaze: face.gaze,
    nose: face.nose, mouth: face.mouth
  };
};

const normalizedSurfaces = (
  analysis: ConstraintAnalysis
): readonly IntentProgramSurface[] => analysis.surfaceOrder.map((surface) => {
  const shape = analysis.shapeBySurface.get(surface.id);
  return shape ? { ...surface, shape } : surface;
});

/** Reports every semantic issue before atomically returning complete IR. */
export const resolveIntentProgramConstraints = (
  ast: IntentProgramSemanticAst,
  reporter: IntentProgramConstraintReporter
): IntentProgramIr | null => {
  const analysis = analyzeIntentProgramConstraints(ast);
  for (const entry of analysis.inspection.issues) {
    reporter.reportPath(entry.code, entry.message, entry.path);
  }
  const support = normalizeSupport(ast.model.support, analysis.supportContacts);
  const face = normalizeFace(ast.model.face);
  const { name, track, domain } = ast.metadata;
  const { orientation, symmetry } = ast.model;
  const idle = ast.animation.idle;
  const { palette } = ast.appearance;
  if (reporter.hasErrors() || !name || !track || !domain || !orientation ||
    !symmetry || !support || !face || !idle || !palette || !analysis.appearance) {
    return null;
  }
  return {
    name,
    track,
    domain,
    orientation,
    symmetry,
    support,
    body: analysis.inspection.bodyOrder,
    surfaces: normalizedSurfaces(analysis),
    face,
    ...(ast.model.focal ? { focal: ast.model.focal } : {}),
    animation: { idle },
    appearance: { palette, ...analysis.appearance }
  };
};
