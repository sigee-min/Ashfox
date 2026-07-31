import type { FormEvent } from 'react';

import type { ProjectDocument } from '@ashfox/engine-core';

import {
  projectExportTargetLabel,
  projectExportTargetFor
} from '../../../application/projectExportTarget';

interface ExportMenuProps {
  document: ProjectDocument;
  busy: boolean;
  onExport: () => void;
}

export function ExportMenu({
  document,
  busy,
  onExport
}: ExportMenuProps) {
  const current = projectExportTargetFor(document);
  const label = projectExportTargetLabel(current.target);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (busy) return;
    onExport();
  };

  return (
    <form
      className="header-popover export-menu"
      aria-label="Export project"
      onSubmit={submit}
    >
      <div className="popover-heading">
        <strong>Export</strong>
        <span>Uses the project target</span>
      </div>
      <div
        className={`project-facts${
          current.gameVersion === null ? '' : ' has-game-version'
        }`}
      >
        <span>
          <small>Format</small>
          <strong>{label}</strong>
        </span>
        {current.gameVersion === null ? null : (
          <span>
            <small>Game version</small>
            <strong>{current.gameVersion}</strong>
          </span>
        )}
        <span>
          <small>Asset</small>
          <strong>{current.modelPath}</strong>
        </span>
      </div>
      <p className="export-adaptation-note">
        Data this target cannot represent may be converted or omitted.
        Your project stays unchanged.
      </p>
      <button
        type="submit"
        className="popover-primary"
        data-ashfox-action="project.export.submit"
        disabled={busy}
      >
        {busy ? 'Exporting…' : `Export ${label}`}
      </button>
    </form>
  );
}
