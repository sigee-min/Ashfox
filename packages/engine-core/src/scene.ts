import type {
  ProjectDocument,
  SceneNode,
  Transform
} from './model';

export const transformsEqual = (
  left: Transform,
  right: Transform
): boolean =>
  (['position', 'rotation', 'scale', 'pivot'] as const).every((property) =>
    left[property].every(
      (value, index) => Math.abs(value - right[property][index]) < 0.0001
    )
  );

export const updateSceneNode = (
  document: ProjectDocument,
  nodeId: string,
  update: (node: SceneNode) => SceneNode
): ProjectDocument => {
  const currentNode = document.scene.nodes[nodeId];
  if (!currentNode) return document;

  const nextNode = update(currentNode);
  if (nextNode === currentNode) return document;

  return {
    ...document,
    scene: {
      ...document.scene,
      nodes: {
        ...document.scene.nodes,
        [nodeId]: nextNode
      }
    }
  };
};

export const addSceneNode = (
  document: ProjectDocument,
  node: SceneNode
): ProjectDocument => {
  if (document.scene.nodes[node.id]) return document;

  return {
    ...document,
    scene: {
      ...document.scene,
      nodes: {
        ...document.scene.nodes,
        [node.id]: node
      }
    }
  };
};
