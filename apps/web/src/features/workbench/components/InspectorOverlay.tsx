import type {
  ProjectDocument,
  SceneNode,
  ValidationReport
} from '@ashfox/engine-core';
import {
  measureDocumentFormComposition,
  readPartRecipe
} from '@ashfox/engine-core';

import { Icon } from '../Icon';
import {
  nodeIcon,
  nodeKindLabel
} from '../presentation/nodePresentation';

interface InspectorOverlayProps {
  document: ProjectDocument;
  node: SceneNode | undefined;
  report: ValidationReport;
}

export function InspectorOverlay({
  document,
  node,
  report
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
  const recipe = compilerOwned ? readPartRecipe(document) : null;
  const semanticPart =
    recipe?.ok && recipe.recipe && node.generation
      ? recipe.recipe.parts.find(
          (part) => part.partId === node.generation?.partId
        )
      : undefined;
  const partComposition = node.generation
    ? measureDocumentFormComposition(document).parts.find(
        (part) => part.partId === node.generation?.partId
      )
    : undefined;

  return (
    <aside className="floating-panel inspector-overlay">
      <div className="inspector-title">
        <span className={`inspector-node-icon kind-${node.kind}`}>
          <Icon name={nodeIcon(node.kind)} />
        </span>
        <span>
          <strong>{node.name}</strong>
          <small>
            {semanticPart
              ? `Semantic ${semanticPart.kind}`
              : nodeKindLabel(node.kind)}
            {' · '}{node.id}
          </small>
        </span>
        <span
          className={`visibility-large is-readonly${node.visible ? ' is-active' : ''}`}
          aria-label={node.visible ? 'Visible compiled output' : 'Hidden compiled output'}
        >
          <Icon name={node.visible ? 'eye' : 'eyeOff'} />
        </span>
      </div>
      <div className="inspector-tabs">
        <span className="is-active">Compiled details</span>
        <span>{compilerOwned ? 'Intent Program owned' : 'Imported output'}</span>
      </div>
      <div className="inspector-scroll">
        {semanticPart ? (
          <section className="property-section">
            <div className="property-heading">
              <span>Semantic part</span>
              <span className="space-label">Iconic</span>
            </div>
            <div className="property-grid">
              <span>Primitive</span>
              <strong>{semanticPart.kind}</strong>
              <span>Material</span>
              <strong>{semanticPart.materialId}</strong>
              <span>Parent</span>
              <strong>{semanticPart.parentPartId ?? 'root'}</strong>
              <span>Compiled cuboids</span>
              <strong>{partComposition?.compiledCuboids ?? 0}</strong>
              <span>Cell-scale cuboids</span>
              <strong>{partComposition?.cellScaleCuboids ?? 0}</strong>
              {semanticPart.kind === 'mass' ? (
                <>
                  <span>Profile</span>
                  <strong>{semanticPart.profile}</strong>
                </>
              ) : null}
            </div>
          </section>
        ) : null}
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
              <strong>Derived from the confirmed intent program</strong>
              <small>Revise the program, then compile a complete replacement.</small>
            </span>
          </div>
        </section>
      </div>
    </aside>
  );
}
