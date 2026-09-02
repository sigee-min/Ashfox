import {
  isMinecraftExportTarget,
  PROJECT_EXPORT_TARGETS,
  projectTargetVersionFor,
  type VisibleExportPreset
} from '../../../application/projectExportTarget';
import {
  isExportModelPathValid,
  isExportNamespaceValid
} from '@ashfox/engine-core';

interface ProjectTargetFieldsProps {
  target: VisibleExportPreset | null;
  namespace: string;
  modelPath: string;
  onTargetChange: (target: VisibleExportPreset) => void;
  onNamespaceChange: (namespace: string) => void;
  onModelPathChange: (modelPath: string) => void;
}

export function ProjectTargetFields({
  target,
  namespace,
  modelPath,
  onTargetChange,
  onNamespaceChange,
  onModelPathChange
}: ProjectTargetFieldsProps) {
  const targetVersion = projectTargetVersionFor(target);
  return (
    <>
      <div
        className="export-target-list"
        role="radiogroup"
        aria-label="Export target"
      >
        {PROJECT_EXPORT_TARGETS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={target === option.id}
            className={target === option.id ? 'is-selected' : ''}
            onClick={() => onTargetChange(option.id)}
          >
            <strong>{option.label}</strong>
            <small>{option.detail}</small>
          </button>
        ))}
      </div>
      {target === null ? null : (
        <div className="export-fields">
          {isMinecraftExportTarget(target) ? (
            <div className="popover-field">
              <span>Current target version</span>
              <output aria-label="Current target version">
                {targetVersion}
              </output>
            </div>
          ) : null}
          {isMinecraftExportTarget(target) ? (
            <label className="popover-field">
              <span>Namespace</span>
              <input
                aria-label="Export namespace"
                aria-invalid={
                  !isExportNamespaceValid(target, namespace)
                }
                value={namespace}
                onChange={(event) =>
                  onNamespaceChange(event.target.value)
                }
              />
            </label>
          ) : null}
          <label className="popover-field project-model-path">
            <span>Export path</span>
            <input
                aria-label="Export model path"
              aria-invalid={
                !isExportModelPathValid(target, modelPath)
              }
              value={modelPath}
              onChange={(event) =>
                onModelPathChange(event.target.value)
              }
            />
          </label>
        </div>
      )}
    </>
  );
}
