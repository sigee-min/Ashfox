import {
  useEffect,
  useState,
  type FormEvent
} from 'react';

import type { ProjectDocument } from '@ashfox/engine-core';

import {
  isMinecraftExportTarget,
  PROJECT_EXPORT_TARGETS,
  projectExportTargetFor,
  type ProjectExportTarget,
} from '../presentation/projectExportTarget';
import { ProjectTargetFields } from './ProjectTargetFields';

interface ExportMenuProps {
  document: ProjectDocument;
  busy: boolean;
  onExport: (target: ProjectExportTarget) => void;
}

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
    (!isMinecraftExportTarget(target) || trimmedNamespace.length > 0);

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
      <ProjectTargetFields
        target={target}
        namespace={namespace}
        modelPath={modelPath}
        onTargetChange={setTarget}
        onNamespaceChange={setNamespace}
        onModelPathChange={setModelPath}
      />
      <button
        type="submit"
        className="popover-primary"
        data-ashfox-action="project.export.submit"
        disabled={!valid || busy}
      >
        {busy ? 'Exporting…' : `Export ${PROJECT_EXPORT_TARGETS.find(
          (option) => option.id === target
        )?.label ?? target}`}
      </button>
    </form>
  );
}
