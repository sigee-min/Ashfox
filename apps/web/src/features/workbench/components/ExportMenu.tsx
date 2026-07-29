import {
  useEffect,
  useState,
  type FormEvent
} from 'react';

import type { ProjectDocument } from '@ashfox/engine-core';

import {
  PROJECT_EXPORT_TARGETS,
  projectExportTargetFor,
  type ProjectExportTarget,
  type VisibleExportPreset
} from '../presentation/projectExportTarget';

interface ExportMenuProps {
  document: ProjectDocument;
  busy: boolean;
  onExport: (target: ProjectExportTarget) => void;
}

const isMinecraftTarget = (
  target: VisibleExportPreset
): boolean =>
  target === 'bedrock' || target === 'geckolib5';

export function ExportMenu({
  document,
  busy,
  onExport
}: ExportMenuProps) {
  const current = projectExportTargetFor(document);
  const [target, setTarget] = useState(current.target);
  const [namespace, setNamespace] = useState(current.namespace);
  const [modelPath, setModelPath] = useState(current.modelPath);

  useEffect(() => {
    const next = projectExportTargetFor(document);
    setTarget(next.target);
    setNamespace(next.namespace);
    setModelPath(next.modelPath);
  }, [document]);

  const trimmedNamespace = namespace.trim();
  const trimmedModelPath = modelPath.trim();
  const valid =
    trimmedModelPath.length > 0 &&
    (!isMinecraftTarget(target) || trimmedNamespace.length > 0);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!valid || busy) return;
    onExport({
      target,
      namespace: trimmedNamespace || 'ashfox',
      modelPath: trimmedModelPath
    });
  };

  return (
    <form
      className="header-popover export-menu"
      aria-label="Export project"
      onSubmit={submit}
    >
      <div className="popover-heading">
        <strong>Export</strong>
        <span>Choose one target</span>
      </div>
      <div className="export-target-list" role="radiogroup" aria-label="Format">
        {PROJECT_EXPORT_TARGETS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={target === option.id}
            className={target === option.id ? 'is-selected' : ''}
            onClick={() => setTarget(option.id)}
          >
            <strong>{option.label}</strong>
            <small>{option.detail}</small>
          </button>
        ))}
      </div>
      <div className="export-fields">
        {isMinecraftTarget(target) ? (
          <label className="popover-field">
            <span>Namespace</span>
            <input
              aria-label="Export namespace"
              value={namespace}
              onChange={(event) => setNamespace(event.target.value)}
            />
          </label>
        ) : null}
        <label className="popover-field">
          <span>Model path</span>
          <input
            aria-label="Export model path"
            value={modelPath}
            onChange={(event) => setModelPath(event.target.value)}
          />
        </label>
      </div>
      <button
        type="submit"
        className="popover-primary"
        disabled={!valid || busy}
      >
        {busy ? 'Exporting…' : `Export ${PROJECT_EXPORT_TARGETS.find(
          (option) => option.id === target
        )?.label ?? target}`}
      </button>
    </form>
  );
}
