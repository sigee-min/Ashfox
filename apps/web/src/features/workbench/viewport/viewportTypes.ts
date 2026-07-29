import type { TransformControlsMode } from 'three/addons/controls/TransformControls.js';

import type {
  ProjectDocument,
  Transform
} from '@ashfox/engine-core';
import type { ProjectAssets } from '../../files/projectAssets';
import type { CameraMode } from './cameraPresets';
import type { ViewportEnvironmentId } from './viewportEnvironment';

export interface ViewportOptions {
  showGrid: boolean;
  showSkeleton: boolean;
  showWireframe: boolean;
}

export interface CameraCommand {
  mode: CameraMode;
  nonce: number;
}

export interface ViewportStats {
  calls: number;
  triangles: number;
}

export interface ViewportProps {
  document: ProjectDocument;
  assets: ProjectAssets;
  selectedNodeId: string | null;
  transformMode: TransformControlsMode;
  snapEnabled: boolean;
  options: ViewportOptions;
  environment: ViewportEnvironmentId;
  cameraCommand: CameraCommand;
  activeClipId: string | null;
  playhead: number;
  playing: boolean;
  onSelectNode: (nodeId: string | null) => void;
  onCommitTransform: (nodeId: string, transform: Transform) => void;
  onStats: (stats: ViewportStats) => void;
}
