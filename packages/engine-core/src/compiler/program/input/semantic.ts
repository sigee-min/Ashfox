import {
  collectIntentProgramConstraintIssues
} from '../../../project/program/constraints';
import type {
  IntentProgramIr,
  IntentProgramSemanticAst,
  IntentProgramSurface,
  IntentProgramSurfaceDeclaration,
  IntentProgramSurfaceShapeDeclaration
} from '../../../project/program/types';
import type { IntentProgramInputReporter } from './contract';

const surfaceDeclaration = (
  surface: IntentProgramSurface
): IntentProgramSurfaceDeclaration => ({
  id: surface.id,
  role: surface.role,
  cardinality: surface.cardinality,
  parent: surface.parent,
  anchor: surface.anchor,
  growth: surface.growth,
  lane: surface.lane
});

const shapeDeclaration = (
  surface: IntentProgramSurface
): IntentProgramSurfaceShapeDeclaration | undefined => surface.shape
  ? { surfaceId: surface.id, shape: surface.shape }
  : undefined;

/**
 * Projects complete canonical IR back onto the resolver's readonly semantic
 * input shape. This is an untrusted-input validation view, never a second
 * authored representation or persisted compatibility format.
 */
const semanticValidationView = (
  program: IntentProgramIr
): IntentProgramSemanticAst => ({
  authorities: {
    metadata: true,
    model: true,
    animation: true,
    appearance: true
  },
  metadata: {
    name: program.name,
    track: program.track,
    domain: program.domain
  },
  model: {
    orientation: program.orientation,
    symmetry: program.symmetry,
    support: program.support,
    body: program.body,
    surfaces: program.surfaces.map(surfaceDeclaration),
    surfaceShapes: program.surfaces.flatMap((surface) => {
      const declaration = shapeDeclaration(surface);
      return declaration ? [declaration] : [];
    }),
    face: program.face,
    ...(program.focal ? { focal: program.focal } : {})
  },
  animation: program.animation,
  appearance: program.appearance
});

/** The resolver remains the sole semantic-policy authority for direct IR. */
export const validateIntentProgramSemantics = (
  program: IntentProgramIr,
  report: IntentProgramInputReporter
): void => {
  const inspection = collectIntentProgramConstraintIssues(
    semanticValidationView(program)
  );
  for (const issue of inspection.issues) {
    report(issue.path, issue.code, issue.message);
  }
};
