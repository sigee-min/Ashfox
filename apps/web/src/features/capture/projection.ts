import type { ProjectDocument } from '@ashfox/engine-core';

import type { ProjectAssets } from '../../application/projectAssets';
import {
  projectToThreeScene
} from '../../rendering/projection';
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
  projectToThreeScene(document, {
    assets,
    showSkeleton: false,
    showTextures: options.showTextures,
    showWireframe: false,
    untexturedColor: '#b59a74'
  });
