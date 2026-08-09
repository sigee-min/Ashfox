import {
  isMinecraftExportTarget,
  PROJECT_EXPORT_TARGETS,
  projectGameVersionOptionsFor,
  type VisibleExportPreset
} from '../../../application/projectExportTarget';
import {
  isExportModelPathValid,
  isExportNamespaceValid,
  type MinecraftGameVersion
} from '@ashfox/engine-core';

interface ProjectTargetFieldsProps {
  target: VisibleExportPreset | null;
  gameVersion: MinecraftGameVersion | null;
  namespace: string;
  modelPath: string;
  onTargetChange: (target: VisibleExportPreset) => void;
  onGameVersionChange: (gameVersion: MinecraftGameVersion) => void;
  onNamespaceChange: (namespace: string) => void;
  onModelPathChange: (modelPath: string) => void;
}

export function ProjectTargetFields({
  target,
  gameVersion,
  namespace,
  modelPath,
  onTargetChange,
  onGameVersionChange,
  onNamespaceChange,
  onModelPathChange
}: ProjectTargetFieldsProps) {
  const gameVersions = projectGameVersionOptionsFor(target);
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
            <label className="popover-field">
              <span>Game version</span>
              <select
                aria-label="Minecraft game version"
                value={gameVersion ?? ''}
                onChange={(event) => {
                  const next = gameVersions.find(
                    (option) => option.value === event.target.value
                  );
                  if (next) onGameVersionChange(next.value);
                }}
              >
                {gameVersions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {isMinecraftExportTarget(target) ? (
            <label className="popover-field">
              <span>Namespace</span>
              <input
                aria-label="Export namespace"
                aria-invalid={
                  !isExportNamespaceValid(target, namespace.trim())
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
                !isExportModelPathValid(target, modelPath.trim())
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
