import type { CSSProperties } from 'react';

import type {
  ProjectDocument,
  ValidationReport
} from '@ashfox/engine-core';

import { Icon } from '../Icon';
import { SceneTree } from './SceneTree';

interface SceneOverlayProps {
  document: ProjectDocument;
  selectedNodeId: string | null;
  report: ValidationReport;
  onSelectNode: (nodeId: string) => void;
  onToggleVisibility: (nodeId: string) => void;
}

export function SceneOverlay({
  document,
  selectedNodeId,
  report,
  onSelectNode,
  onToggleVisibility
}: SceneOverlayProps) {
  return (
    <aside className="floating-panel scene-overlay">
      <div className="panel-heading">
        <span>Project scene</span>
      </div>
      <div className="scene-search">
        <Icon name="search" />
        <span>Filter scene</span>
        <kbd>⌘F</kbd>
      </div>
      <div className="overlay-scroll">
        <SceneTree
          document={document}
          selectedNodeId={selectedNodeId}
          onSelect={onSelectNode}
          onToggleVisibility={onToggleVisibility}
        />
        <div className="panel-section-divider" />
        <div className="panel-heading compact">
          <span>Textures</span>
          <span className="panel-count">
            {Object.keys(document.textures).length}
          </span>
        </div>
        <div className="asset-list">
          {Object.values(document.textures).map((texture) => (
            <button type="button" className="asset-row" key={texture.id}>
              <span
                className="texture-swatch"
                style={{
                  '--swatch-color': String(
                    texture.metadata?.previewColor ?? '#8e98a3'
                  )
                } as CSSProperties}
              />
              <span className="asset-copy">
                <strong>{texture.name}</strong>
                <small>{texture.width} × {texture.height} · sRGB</small>
              </span>
              <Icon name="texture" />
            </button>
          ))}
        </div>
      </div>
      <div className="validation-summary">
        <span className={`validation-icon${report.valid ? ' is-valid' : ''}`}>
          <Icon name={report.valid ? 'check' : 'warning'} />
        </span>
        <span>
          <strong>
            {report.valid ? 'Ready to render' : `${report.findings.length} issues`}
          </strong>
          <small>Canonical document</small>
        </span>
      </div>
    </aside>
  );
}
