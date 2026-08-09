import type { IntentProgramLoweringArtifacts } from '../lower/context';
import type { IntentProgramGraphNode } from '../contract';
import { compareStableText } from '../../../stableOrder';

const stable = <T extends { readonly id: string }>(
  entries: readonly T[]
): readonly T[] => [...entries].sort((left, right) =>
  compareStableText(left.id, right.id)
);

const unique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort(compareStableText);

/** Finalizes the emitter graph without exposing its mutable construction. */
export const finalizeIntentProgramGraph = (
  artifacts: IntentProgramLoweringArtifacts
): readonly IntentProgramGraphNode[] => {
  const children = new Map<string, string[]>();
  for (const node of artifacts.graph) {
    if (!node.parentId) continue;
    const childIds = children.get(node.parentId);
    if (childIds) childIds.push(node.id);
    else children.set(node.parentId, [node.id]);
  }
  return stable(artifacts.graph).map((node) => Object.freeze({
    ...node,
    children: Object.freeze(unique(children.get(node.id) ?? []))
  }));
};
