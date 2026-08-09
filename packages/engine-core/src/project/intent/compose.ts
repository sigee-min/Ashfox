import type {
  ProjectReferenceObservation,
  ProjectSemanticContract,
  ProjectSymmetry
} from '../../model';
import {
  normalizeProjectAppearance,
  type NormalizedProjectAppearance
} from '../appearance/reader';
import { normalizeProjectSemanticContract } from '../semantic/contract';
import { ProjectIntentIssueCollector } from './result';

export interface ProjectIntentComposition {
  readonly semanticContract: ProjectSemanticContract | null;
  readonly appearance: NormalizedProjectAppearance;
}

export const normalizeIntentComposition = (
  value: Readonly<Record<string, unknown>>,
  grounding: unknown,
  symmetry: ProjectSymmetry | null,
  references: readonly ProjectReferenceObservation[],
  issues: ProjectIntentIssueCollector
): ProjectIntentComposition => {
  const semanticContract = issues.capture((sink) =>
    normalizeProjectSemanticContract(
      value.semanticContract,
      grounding,
      symmetry,
      references,
      sink
    )
  );
  const appearance = issues.capture((sink) => normalizeProjectAppearance(
    value.appearance,
    value.appearanceBindings,
    sink
  ));
  return { semanticContract, appearance };
};
