import type {
  CubeNode,
  ProjectDocument,
  SceneNode,
  Vec3
} from '../model';

export interface WorldAxisAlignedBounds {
  min: Vec3;
  max: Vec3;
}

const add = (left: Vec3, right: Vec3): Vec3 => [
  left[0] + right[0],
  left[1] + right[1],
  left[2] + right[2]
];

const subtract = (left: Vec3, right: Vec3): Vec3 => [
  left[0] - right[0],
  left[1] - right[1],
  left[2] - right[2]
];

const parentCanonicalOrigin = (
  document: ProjectDocument,
  node: SceneNode
): Vec3 => {
  if (node.parentId === null) return [0, 0, 0];
  const parent = document.scene.nodes[node.parentId];
  return parent?.kind === 'bone'
    ? add(parent.transform.pivot, parent.transform.position)
    : [0, 0, 0];
};

const localTranslation = (
  document: ProjectDocument,
  node: SceneNode
): Vec3 =>
  node.kind === 'locator'
    ? node.transform.position
    : subtract(
        add(node.transform.pivot, node.transform.position),
        parentCanonicalOrigin(document, node)
      );

const rotateX = (point: Vec3, radians: number): Vec3 => {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    point[0],
    point[1] * cosine - point[2] * sine,
    point[1] * sine + point[2] * cosine
  ];
};

const rotateY = (point: Vec3, radians: number): Vec3 => {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    point[0] * cosine + point[2] * sine,
    point[1],
    -point[0] * sine + point[2] * cosine
  ];
};

const rotateZ = (point: Vec3, radians: number): Vec3 => {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    point[0] * cosine - point[1] * sine,
    point[0] * sine + point[1] * cosine,
    point[2]
  ];
};

const applyLocalTransform = (
  document: ProjectDocument,
  node: SceneNode,
  point: Vec3
): Vec3 => {
  const scaled: Vec3 = [
    point[0] * node.transform.scale[0],
    point[1] * node.transform.scale[1],
    point[2] * node.transform.scale[2]
  ];
  const degrees = node.transform.rotation;
  const radians = Math.PI / 180;
  const rotated = rotateZ(
    rotateY(
      rotateX(scaled, degrees[0] * radians),
      degrees[1] * radians
    ),
    degrees[2] * radians
  );
  return add(rotated, localTranslation(document, node));
};

const transformToWorld = (
  document: ProjectDocument,
  node: SceneNode,
  point: Vec3,
  visiting: ReadonlySet<string>
): Vec3 => {
  if (visiting.has(node.id)) {
    throw new Error(`Scene hierarchy cycle at "${node.id}".`);
  }
  const local = applyLocalTransform(document, node, point);
  if (node.parentId === null) return local;
  const parent = document.scene.nodes[node.parentId];
  if (!parent) return local;
  return transformToWorld(
    document,
    parent,
    local,
    new Set([...visiting, node.id])
  );
};

const cubeLocalCorners = (cube: CubeNode): readonly Vec3[] => {
  const from: Vec3 = [
    cube.bounds.from[0] - cube.transform.pivot[0] - cube.inflate,
    cube.bounds.from[1] - cube.transform.pivot[1] - cube.inflate,
    cube.bounds.from[2] - cube.transform.pivot[2] - cube.inflate
  ];
  const to: Vec3 = [
    cube.bounds.to[0] - cube.transform.pivot[0] + cube.inflate,
    cube.bounds.to[1] - cube.transform.pivot[1] + cube.inflate,
    cube.bounds.to[2] - cube.transform.pivot[2] + cube.inflate
  ];
  return [from[0], to[0]].flatMap((x) =>
    [from[1], to[1]].flatMap((y) =>
      [from[2], to[2]].map((z): Vec3 => [x, y, z])
    )
  );
};

export const worldCubeBounds = (
  document: ProjectDocument,
  cube: CubeNode
): WorldAxisAlignedBounds => {
  const corners = cubeLocalCorners(cube).map((corner) =>
    transformToWorld(document, cube, corner, new Set())
  );
  return {
    min: [
      Math.min(...corners.map((corner) => corner[0])),
      Math.min(...corners.map((corner) => corner[1])),
      Math.min(...corners.map((corner) => corner[2]))
    ],
    max: [
      Math.max(...corners.map((corner) => corner[0])),
      Math.max(...corners.map((corner) => corner[1])),
      Math.max(...corners.map((corner) => corner[2]))
    ]
  };
};

export const worldBoundsOverlap = (
  left: WorldAxisAlignedBounds,
  right: WorldAxisAlignedBounds,
  epsilon = 0.000001
): boolean =>
  left.min.every(
    (minimum, axis) =>
      Math.min(left.max[axis], right.max[axis]) -
      Math.max(minimum, right.min[axis]) >
      epsilon
  );
