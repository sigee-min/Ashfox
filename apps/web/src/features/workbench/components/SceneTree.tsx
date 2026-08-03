import {
  useMemo,
  type CSSProperties,
  type ReactNode
} from 'react';

import type {
  ModelFeatureMotif,
  ProjectDocument,
  SceneNode
} from '@ashfox/engine-core';
import {
  readPartRecipe
} from '@ashfox/engine-core';

import { Icon } from '../Icon';
import { nodeIcon } from '../presentation/nodePresentation';

interface SceneTreeProps {
  document: ProjectDocument;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
  onToggleVisibility: (nodeId: string) => void;
}

const indexChildrenByParent = (
  nodes: Readonly<Record<string, SceneNode>>
): Map<string | null, SceneNode[]> => {
  const childrenByParent = new Map<string | null, SceneNode[]>();
  for (const node of Object.values(nodes)) {
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort((left, right) => left.name.localeCompare(right.name));
  }
  return childrenByParent;
};

export function SceneTree({
  document,
  selectedNodeId,
  onSelect,
  onToggleVisibility
}: SceneTreeProps) {
  const childrenByParent = useMemo(
    () => indexChildrenByParent(document.scene.nodes),
    [document.scene.nodes]
  );
  const featurePartsByParent = useMemo(() => {
    const recipe = readPartRecipe(document);
    const result = new Map<
      string,
      { partId: string; motif: ModelFeatureMotif }[]
    >();
    if (!recipe.ok || recipe.recipe === null) return result;
    for (const part of recipe.recipe.parts) {
      if (part.kind !== 'feature' || part.parentPartId === null) continue;
      const features = result.get(part.parentPartId) ?? [];
      features.push({ partId: part.partId, motif: part.motif });
      result.set(part.parentPartId, features);
    }
    for (const features of result.values()) {
      features.sort((left, right) =>
        left.partId.localeCompare(right.partId)
      );
    }
    return result;
  }, [document]);

  const renderNode = (node: SceneNode, depth: number): ReactNode => {
    const children = childrenByParent.get(node.id) ?? [];
    const isSemanticPart =
      node.kind === 'bone' &&
      node.generation?.authority === 'ashfox.part-compiler';
    const cubeChildren = children.filter((child) => child.kind === 'cube');
    const visibleChildren = children.filter((child) => child.kind !== 'cube');
    const featureParts = isSemanticPart && node.generation
      ? featurePartsByParent.get(node.generation.partId) ?? []
      : [];
    const hasSemanticChildren =
      visibleChildren.length > 0 || featureParts.length > 0;
    return (
      <div key={node.id}>
        <div
          className={`tree-row${selectedNodeId === node.id ? ' is-selected' : ''}`}
          data-ashfox-entity-id={node.id}
          style={{ '--tree-depth': depth } as CSSProperties}
        >
          <button
            type="button"
            className="tree-select"
            onClick={() => onSelect(node.id)}
          >
            <span className="tree-chevron">
              {hasSemanticChildren ? <Icon name="chevron" /> : null}
            </span>
            <Icon
              className={`node-icon kind-${node.kind}`}
              name={nodeIcon(node.kind)}
            />
            <span className="tree-label">{node.name}</span>
            {cubeChildren.length > 0 ? (
              <span className="tree-count">
                {cubeChildren.length} {cubeChildren.length === 1 ? 'cube' : 'cubes'}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className={`visibility-toggle${node.visible ? '' : ' is-hidden'}`}
            aria-label={`${node.name} ${node.visible ? '숨기기' : '표시하기'}`}
            disabled={
              node.generation?.authority === 'ashfox.part-compiler'
            }
            onClick={() => onToggleVisibility(node.id)}
          >
            <Icon name={node.visible ? 'eye' : 'eyeOff'} />
          </button>
        </div>
        {visibleChildren.map((child) => renderNode(child, depth + 1))}
        {featureParts.map((feature) => (
          <div
            key={feature.partId}
            className="tree-row is-derived-feature"
            style={{ '--tree-depth': depth + 1 } as CSSProperties}
          >
            <span className="tree-chevron" />
            <Icon
              className="node-icon kind-feature"
              name={
                feature.motif === 'patch'
                  ? 'texture'
                  : feature.motif === 'eye'
                    ? 'eye'
                    : 'spark'
              }
            />
            <span className="tree-label">{feature.partId}</span>
            <span className="tree-count">
              {feature.motif === 'patch'
                ? 'generated patch'
                : 'pixel glyph'}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const rootNodes = childrenByParent.get(null) ?? [];
  const rootCubes = rootNodes.filter((node) => node.kind === 'cube');

  return (
    <div className="scene-tree">
      {rootNodes
        .filter((node) => node.kind !== 'cube')
        .map((node) => renderNode(node, 0))}
      {rootCubes.length > 0 ? (
        <div className="tree-row is-geometry-summary">
          <span className="tree-chevron" />
          <Icon className="node-icon kind-cube" name="cube" />
          <span className="tree-label">ungrouped geometry</span>
          <span className="tree-count">{rootCubes.length} cubes</span>
        </div>
      ) : null}
    </div>
  );
}
