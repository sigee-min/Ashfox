import type {
  IntentProgramAttachmentAnchor,
  IntentProgramAttachmentLane,
  IntentProgramAttachedModule,
  IntentProgramGrowthDirection,
  IntentProgramSurfaceDeclaration,
  IntentProgramSurfaceShape
} from '../types';
import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from '../language';

export const INTENT_PROGRAM_RELATION_SPECIFICATION =
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION.relations;
const relations = INTENT_PROGRAM_RELATION_SPECIFICATION;
export const isIntentProgramLaneCompatible = (
  anchor: IntentProgramAttachmentAnchor,
  lane: IntentProgramAttachmentLane
): boolean => (relations.lanesByAnchor[anchor] as readonly string[])
  .includes(lane);

export type IntentProgramRelationField =
  'cardinality' | 'anchor' | 'growth';

export interface IntentProgramRelationIssue {
  readonly field: IntentProgramRelationField;
  readonly message: string;
}

const relationFields = Object.freeze([
  'cardinality', 'anchor', 'growth'
] as const);

const nearestRelationIssues = (
  actual: readonly string[],
  candidates: readonly (readonly string[])[],
  subject: string
): readonly IntentProgramRelationIssue[] => {
  let mismatches: readonly IntentProgramRelationField[] = relationFields;
  for (const candidate of candidates) {
    const candidateMismatches = relationFields.filter(
      (_, index) => actual[index] !== candidate[index]
    );
    if (candidateMismatches.length < mismatches.length) {
      mismatches = candidateMismatches;
      if (mismatches.length === 0) break;
    }
  }
  return mismatches.map((field) => ({
    field,
    message: `${subject} ${field} does not match a supported attachment relation`
  }));
};

export const intentProgramModuleRelationIssues = (
  module: IntentProgramAttachedModule
): readonly IntentProgramRelationIssue[] => {
  const bodyCardinality = INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements
    .model.body.fields.cardinality;
  const expectedCardinality = bodyCardinality.fixedByKind[module.kind];
  const cardinalityIssue: readonly IntentProgramRelationIssue[] =
    module.cardinality === expectedCardinality
      ? []
      : [{
          field: 'cardinality',
          message: `${module.kind} module cardinality must be ${expectedCardinality}`
        }];
  const spatialIssues = nearestRelationIssues(
    [expectedCardinality, module.anchor, module.growth],
    relations.moduleTuples
      .filter((entry) => entry[0] === module.kind)
      .map((entry) => entry.slice(1)),
    `${module.kind} module`
  ).filter((issue) => issue.field !== 'cardinality');
  return [...cardinalityIssue, ...spatialIssues];
};

export const intentProgramSurfaceRelationIssues = (
  surface: IntentProgramSurfaceDeclaration
): readonly IntentProgramRelationIssue[] => nearestRelationIssues(
  [surface.cardinality, surface.anchor, surface.growth],
  relations.surfaceTuples,
  'surface'
);

export type IntentProgramShapeIssue = Readonly<{
  field: 'axis' | 'offset';
  code: string;
  message: string;
}>;

const surfaceShapeCompatibility =
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION.surfaceShapes.compatibility;
const contains = (values: readonly string[], value: string): boolean =>
  values.some((entry) => entry === value);

export const intentProgramSurfaceShapeIssues = (
  growth: IntentProgramGrowthDirection,
  shape: IntentProgramSurfaceShape
): readonly IntentProgramShapeIssue[] => {
  const issues: IntentProgramShapeIssue[] = [];
  if (contains(
    surfaceShapeCompatibility.parallelGrowthByAxis[shape.axis],
    growth
  )) {
    issues.push({
      field: 'axis',
      code: 'intent.surface_shape_axis_parallel',
      message: `Shape axis ${shape.axis} is parallel to surface growth ${growth}.`
    });
  }
  if (!contains(
    surfaceShapeCompatibility.allowedOffsetsByAxis[shape.axis],
    shape.offset
  )) {
    issues.push({
      field: 'offset',
      code: 'intent.surface_shape_offset_mismatch',
      message: `Shape offset ${shape.offset} is not meaningful on axis ${shape.axis}.`
    });
  }
  return issues;
};
