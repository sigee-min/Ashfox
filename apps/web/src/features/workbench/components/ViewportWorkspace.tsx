import type { TransformControlsMode } from 'three/addons/controls/TransformControls.js';

import type {
  ProjectDocument,
  Transform,
  ValidationReport,
  Vec3
} from '@ashfox/engine-core';

import { Icon } from '../Icon';
import { nodeIcon } from '../presentation/nodePresentation';
import {
  Viewport
} from '../Viewport';
import type {
  CameraCommand,
  ViewportOptions,
  ViewportStats
} from '../viewport/viewportTypes';
import type {
  AgentCommandPortStatus
} from '../../agent/AgentCommandPort';
import type { ProjectAssets } from '../../files/projectAssets';
import { InspectorOverlay } from './InspectorOverlay';
import { SceneOverlay } from './SceneOverlay';

export type ViewportOverlay = 'scene' | 'inspector' | null;

interface ViewportWorkspaceProps {
  document: ProjectDocument;
  assets: ProjectAssets;
  report: ValidationReport;
  selectedNodeId: string | null;
  transformMode: TransformControlsMode;
  snapEnabled: boolean;
  viewportOptions: ViewportOptions;
  cameraCommand: CameraCommand;
  viewportStats: ViewportStats;
  activeClipId: string | null;
  playhead: number;
  playing: boolean;
  agentStatus: AgentCommandPortStatus;
  activeOverlay: ViewportOverlay;
  onOverlayChange: (overlay: ViewportOverlay) => void;
  onSelectNode: (nodeId: string | null) => void;
  onAddCube: () => void;
  onToggleVisibility: (nodeId: string) => void;
  onTransformProperty: (
    property: keyof Transform,
    value: Vec3
  ) => void;
  onCommitTransform: (nodeId: string, transform: Transform) => void;
  onRenderedRevision: (revision: string) => void;
  onStats: (stats: ViewportStats) => void;
}

export function ViewportWorkspace({
  document,
  assets,
  report,
  selectedNodeId,
  transformMode,
  snapEnabled,
  viewportOptions,
  cameraCommand,
  viewportStats,
  activeClipId,
  playhead,
  playing,
  agentStatus,
  activeOverlay,
  onOverlayChange,
  onSelectNode,
  onAddCube,
  onToggleVisibility,
  onTransformProperty,
  onCommitTransform,
  onRenderedRevision,
  onStats
}: ViewportWorkspaceProps) {
  const selectedNode = selectedNodeId
    ? document.scene.nodes[selectedNodeId]
    : undefined;

  const toggleOverlay = (
    overlay: Exclude<ViewportOverlay, null>
  ): void => {
    onOverlayChange(activeOverlay === overlay ? null : overlay);
  };

  return (
    <section className="workspace-grid">
      <section className="viewport-panel">
        <Viewport
          document={document}
          assets={assets}
          selectedNodeId={selectedNodeId}
          transformMode={transformMode}
          snapEnabled={snapEnabled}
          options={viewportOptions}
          cameraCommand={cameraCommand}
          activeClipId={activeClipId}
          playhead={playhead}
          playing={playing}
          onSelectNode={onSelectNode}
          onCommitTransform={onCommitTransform}
          onRenderedRevision={onRenderedRevision}
          onStats={onStats}
        />
        <div className="viewport-top-left">
          <button
            type="button"
            className={`panel-trigger${activeOverlay === 'scene' ? ' is-active' : ''}`}
            aria-expanded={activeOverlay === 'scene'}
            onClick={() => toggleOverlay('scene')}
          >
            <Icon name="cube" />
            <span>Scene</span>
            <small>{Object.keys(document.scene.nodes).length}</small>
          </button>
          <div className="view-chip">
            <Icon name="camera" />
            {cameraCommand.mode}
          </div>
        </div>
        <div className="viewport-top-right">
          <div className="render-stats">
            <span>{viewportStats.triangles.toLocaleString()} tris</span>
            <span>{viewportStats.calls} draws</span>
          </div>
          <div
            className={`agent-connection-state is-${agentStatus}`}
            role="status"
            aria-label={`Codex ${agentStatus}`}
          >
            <span aria-hidden="true" />
            Codex {agentStatus === 'working' ? 'Working' : 'Connected'}
          </div>
          <button
            type="button"
            className={`panel-trigger${activeOverlay === 'inspector' ? ' is-active' : ''}`}
            aria-expanded={activeOverlay === 'inspector'}
            onClick={() => toggleOverlay('inspector')}
          >
            <span>Inspect</span>
            <Icon name={selectedNode ? nodeIcon(selectedNode.kind) : 'cube'} />
          </button>
        </div>

        {activeOverlay === 'scene' ? (
          <SceneOverlay
            document={document}
            selectedNodeId={selectedNodeId}
            report={report}
            onAddCube={onAddCube}
            onSelectNode={onSelectNode}
            onToggleVisibility={onToggleVisibility}
          />
        ) : null}

        {activeOverlay === 'inspector' ? (
          <InspectorOverlay
            node={selectedNode}
            report={report}
            onToggleVisibility={onToggleVisibility}
            onTransformProperty={onTransformProperty}
          />
        ) : null}

        <div className="axis-cube" aria-hidden="true">
          <span className="axis-cube-top">Y</span>
          <span className="axis-cube-front">Z</span>
          <span className="axis-cube-side">X</span>
        </div>
      </section>
    </section>
  );
}
