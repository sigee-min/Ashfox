import {
  useEffect,
  useState,
  type FormEvent
} from 'react';

import {
  isExportModelPathValid,
  isExportNamespaceValid,
  type ExportAdapterInput,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  defaultExportAdapterFor,
  defaultProjectGameVersionFor,
  exportAdapterInputFor,
  isMinecraftExportTarget,
  projectExportTargetLabel,
  type ExportAdapterDraft
} from '../../../application/projectExportTarget';
import { ProjectTargetFields } from './ProjectTargetFields';
import type {
  ExportAvailabilityViewModel
} from '../exportAvailability';

interface ExportMenuProps {
  document: ProjectDocument;
  busy: boolean;
  availability: ExportAvailabilityViewModel;
  onExport: (adapter: ExportAdapterInput) => void;
}

const adapterIsValid = (adapter: ExportAdapterDraft): boolean =>
  isExportModelPathValid(adapter.target, adapter.modelPath.trim()) &&
  (
    !isMinecraftExportTarget(adapter.target) ||
    (
      adapter.gameVersion !== null &&
      isExportNamespaceValid(adapter.target, adapter.namespace.trim())
    )
  );

export function ExportMenu({
  document,
  busy,
  availability,
  onExport
}: ExportMenuProps) {
  const [adapter, setAdapter] = useState<ExportAdapterDraft>(() =>
    defaultExportAdapterFor(document)
  );

  useEffect(() => {
    setAdapter(defaultExportAdapterFor(document));
  }, [document.id]);

  const valid = adapterIsValid(adapter);
  const label = projectExportTargetLabel(adapter.target);
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (busy || !valid || !availability.allowed) return;
    onExport(exportAdapterInputFor(adapter));
  };

  return (
    <form
      className="header-popover export-menu"
      aria-label="Export delivery files"
      onSubmit={submit}
    >
      <div className="popover-heading">
        <strong>Delivery export</strong>
        <span>Does not change this project</span>
      </div>
      <ProjectTargetFields
        target={adapter.target}
        gameVersion={adapter.gameVersion}
        namespace={adapter.namespace}
        modelPath={adapter.modelPath}
        onTargetChange={(target) => {
          setAdapter((current) => ({
            ...current,
            target,
            gameVersion: defaultProjectGameVersionFor(target)
          }));
        }}
        onGameVersionChange={(gameVersion) => {
          setAdapter((current) => ({ ...current, gameVersion }));
        }}
        onNamespaceChange={(namespace) => {
          setAdapter((current) => ({ ...current, namespace }));
        }}
        onModelPathChange={(modelPath) => {
          setAdapter((current) => ({ ...current, modelPath }));
        }}
      />
      <p className="export-adaptation-note">
        Target, game version, namespace, and path are delivery settings. The
        canonical model, textures, rig, animation, and Intent Program remain
        unchanged.
      </p>
      <p
        className={`export-readiness is-${availability.allowed ? 'ready' : 'blocked'}`}
        role={availability.allowed ? undefined : 'status'}
      >
        {availability.message}
      </p>
      <button
        type="submit"
        className="popover-primary"
        data-ashfox-action="project.export.submit"
        disabled={busy || !valid || !availability.allowed}
      >
        {busy ? 'Exporting…' : `Export ${label} files`}
      </button>
    </form>
  );
}
