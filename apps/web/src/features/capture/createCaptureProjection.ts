import type { ProjectDocument } from '@ashfox/engine-core';

import type { ProjectAssets } from '../../application/projectAssets';
import {
  projectToThreeScene
} from '../../rendering/projectSceneProjection';
import type {
  ProjectSceneProjection
} from '../../rendering/sceneTypes';

export interface CaptureProjectionOptions {
  showTextures?: boolean;
}

export const createCaptureProjection = (
  document: ProjectDocument,
  assets: ProjectAssets,
  options: CaptureProjectionOptions = {}
): ProjectSceneProjection =>
  projectToThreeScene(options.showTextures === false
    ? { ...document, textures: {} }
    : document, {
    assets,
    showSkeleton: false,
    showWireframe: false,
    untexturedColor: '#b59a74'
  });
