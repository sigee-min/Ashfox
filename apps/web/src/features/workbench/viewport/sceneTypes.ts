import type * as THREE from 'three';
import type { ProjectAssets } from '../../files/projectAssets';

export interface ProjectSceneOptions {
  assets: ProjectAssets;
  showSkeleton: boolean;
  showWireframe: boolean;
}

export interface ProjectSceneProjection {
  root: THREE.Group;
  objectsByNodeId: Map<string, THREE.Group>;
  selectable: THREE.Object3D[];
  dispose: () => void;
}
