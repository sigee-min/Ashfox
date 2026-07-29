import {
  useMemo,
  type CSSProperties,
  type ReactNode
} from 'react';

import type {
  ProjectDocument,
  SceneNode
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

  const renderNode = (node: SceneNode, depth: number): ReactNode => {
    const children = childrenByParent.get(node.id) ?? [];
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
              {children.length > 0 ? <Icon name="chevron" /> : null}
            </span>
            <Icon
              className={`node-icon kind-${node.kind}`}
              name={nodeIcon(node.kind)}
            />
            <span className="tree-label">{node.name}</span>
          </button>
          <button
            type="button"
            className={`visibility-toggle${node.visible ? '' : ' is-hidden'}`}
            aria-label={`${node.name} ${node.visible ? '숨기기' : '표시하기'}`}
            onClick={() => onToggleVisibility(node.id)}
          >
            <Icon name={node.visible ? 'eye' : 'eyeOff'} />
          </button>
        </div>
        {children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="scene-tree">
      {(childrenByParent.get(null) ?? []).map((node) => renderNode(node, 0))}
    </div>
  );
}
