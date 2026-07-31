import {
  isMinecraftExportTarget,
  PROJECT_EXPORT_TARGETS,
  type VisibleExportPreset
} from '../../../application/projectExportTarget';

interface ProjectTargetFieldsProps {
  target: VisibleExportPreset;
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
  return (
    <>
      <div
        className="export-target-list"
        role="radiogroup"
        aria-label="Format"
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
      <div className="export-fields">
        {isMinecraftExportTarget(target) ? (
          <label className="popover-field">
            <span>Namespace</span>
            <input
              aria-label="Project namespace"
              value={namespace}
              onChange={(event) => onNamespaceChange(event.target.value)}
            />
          </label>
        ) : null}
        <label className="popover-field">
          <span>Model path</span>
          <input
            aria-label="Project model path"
            value={modelPath}
            onChange={(event) => onModelPathChange(event.target.value)}
          />
        </label>
      </div>
    </>
  );
}
