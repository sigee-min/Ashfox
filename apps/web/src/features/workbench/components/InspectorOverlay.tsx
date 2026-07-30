import type {
  SceneNode,
  Transform,
  ValidationReport,
  Vec3
} from '@ashfox/engine-core';

import { Icon } from '../Icon';
import {
  nodeIcon,
  nodeKindLabel,
  roundProjectValue
} from '../presentation/nodePresentation';
import { VectorEditor } from './VectorEditor';

interface InspectorOverlayProps {
  node: SceneNode | undefined;
  report: ValidationReport;
  onToggleVisibility: (nodeId: string) => void;
  onTransformProperty: (
    property: keyof Transform,
    value: Vec3
  ) => void;
}

function CubeGeometrySummary({
  node
}: {
  node: Extract<SceneNode, { kind: 'cube' }>;
}) {
  const size = node.bounds.to.map((value, index) =>
    roundProjectValue(value - node.bounds.from[index])
  );
  const enabledFaceCount = Object.values(node.faces).filter(
    (face) => face.enabled
  ).length;

  return (
    <section className="property-section">
      <div className="property-heading">
        <span>Geometry</span>
        <span className="space-label">Cube</span>
      </div>
      <div className="property-grid">
        <span>Size</span>
        <strong>{size.join(' × ')}</strong>
        <span>Inflate</span>
        <strong>{node.inflate}</strong>
        <span>Faces</span>
        <strong>{enabledFaceCount} / 6</strong>
      </div>
    </section>
  );
}

export function InspectorOverlay({
  node,
  report,
  onToggleVisibility,
  onTransformProperty
}: InspectorOverlayProps) {
  if (!node) {
    return (
      <aside className="floating-panel inspector-overlay">
        <div className="empty-inspector">
          <Icon name="cube" />
          <strong>No selection</strong>
          <span>Select an object in the viewport.</span>
        </div>
      </aside>
    );
  }
  const compilerOwned =
    node.generation?.authority === 'ashfox.part-compiler';

  return (
    <aside className="floating-panel inspector-overlay">
      <div className="inspector-title">
        <span className={`inspector-node-icon kind-${node.kind}`}>
          <Icon name={nodeIcon(node.kind)} />
        </span>
        <span>
          <strong>{node.name}</strong>
          <small>{nodeKindLabel(node.kind)} · {node.id}</small>
        </span>
        <button
          type="button"
          className={`visibility-large${node.visible ? ' is-active' : ''}`}
          aria-label="Toggle visibility"
          disabled={compilerOwned}
          onClick={() => onToggleVisibility(node.id)}
        >
          <Icon name={node.visible ? 'eye' : 'eyeOff'} />
        </button>
      </div>
      <div className="inspector-tabs">
        <button type="button" className="is-active">Transform</button>
        <span>{compilerOwned ? 'Compiler owned' : 'Live document'}</span>
      </div>
      <div className="inspector-scroll">
        <section className="property-section">
          <div className="property-heading">
            <span>Transform</span>
            <span className="space-label">Local</span>
          </div>
          <VectorEditor
            label="Position"
            value={node.transform.position}
            step={0.5}
            disabled={compilerOwned}
            onChange={(value) => onTransformProperty('position', value)}
          />
          <VectorEditor
            label="Rotation"
            value={node.transform.rotation}
            step={1}
            disabled={compilerOwned}
            onChange={(value) => onTransformProperty('rotation', value)}
          />
          <VectorEditor
            label="Scale"
            value={node.transform.scale}
            step={0.1}
            disabled={compilerOwned}
            onChange={(value) => onTransformProperty('scale', value)}
          />
        </section>
        <section className="property-section">
          <div className="property-heading">
            <span>Pivot</span>
            <span className="space-label">Model</span>
          </div>
          <VectorEditor
            label="Origin"
            value={node.transform.pivot}
            step={0.5}
            disabled={compilerOwned}
            onChange={(value) => onTransformProperty('pivot', value)}
          />
        </section>
        {node.kind === 'cube' ? <CubeGeometrySummary node={node} /> : null}
        <section className="property-section">
          <div className="property-heading">
            <span>Diagnostics</span>
            <span className={`status-tiny${report.valid ? ' is-valid' : ''}`}>
              {report.valid ? 'Clean' : 'Review'}
            </span>
          </div>
          <div className="diagnostic-row">
            <span className="diagnostic-dot" />
            <span>
              <strong>Transform is target-safe</strong>
              <small>glTF 2.0 · right-handed Y-up</small>
            </span>
          </div>
        </section>
      </div>
    </aside>
  );
}
