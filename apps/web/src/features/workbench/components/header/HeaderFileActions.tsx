import type { RefObject } from 'react';

import type { ArtifactFile } from '../../../files/artifactFile';
import type { FileOperationState } from '../../../files/fileOperationState';
import { Icon } from '../../Icon';
import type {
  HeaderMenu,
  OpenHeaderMenu
} from './headerMenu';

interface HeaderFileActionsProps {
  activeMenu: HeaderMenu;
  fileOperation: FileOperationState<ArtifactFile>;
  artifactFile: ArtifactFile | null;
  artifactUrl: string | null;
  openInputRef: RefObject<HTMLInputElement | null>;
  artifactAnchorRef: RefObject<HTMLAnchorElement | null>;
  onToggleMenu: (menu: OpenHeaderMenu) => void;
  onOpen: (file: File) => void;
  onSave: () => void;
}

const operationLabel = (
  operation: FileOperationState<ArtifactFile>,
  kind: 'open' | 'save' | 'export' | 'capture',
  idle: string,
  running: string
): string =>
  operation.phase === 'running' && operation.kind === kind
    ? running
    : idle;

export function HeaderFileActions({
  activeMenu,
  fileOperation,
  artifactFile,
  artifactUrl,
  openInputRef,
  artifactAnchorRef,
  onToggleMenu,
  onOpen,
  onSave
}: HeaderFileActionsProps) {
  const fileBusy = fileOperation.phase === 'running';
  const captureBusy = fileBusy && fileOperation.kind === 'capture';
  return (
    <div
      className="file-actions"
      title={fileOperation.message ?? 'Project files'}
      aria-busy={fileBusy}
    >
      <button
        type="button"
        disabled={fileBusy}
        aria-expanded={activeMenu === 'new'}
        data-ashfox-action="project.new.open"
        onClick={() => onToggleMenu('new')}
      >
        New
      </button>
      <button
        type="button"
        disabled={fileBusy}
        data-ashfox-action="project.open"
        onClick={() => openInputRef.current?.click()}
      >
        {operationLabel(fileOperation, 'open', 'Open', 'Opening…')}
      </button>
      <input
        ref={openInputRef}
        type="file"
        hidden
        aria-label="Open project file"
        accept=".ashfox,application/vnd.ashfox.project+zip,application/zip"
        data-ashfox-action="project.open.input"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) onOpen(file);
        }}
      />
      <button
        type="button"
        disabled={fileBusy}
        data-ashfox-action="project.save"
        onClick={onSave}
      >
        {operationLabel(fileOperation, 'save', 'Save', 'Saving…')}
      </button>
      <button
        type="button"
        className="is-primary"
        disabled={fileBusy}
        aria-expanded={activeMenu === 'export'}
        data-ashfox-action="project.export.open"
        onClick={() => onToggleMenu('export')}
      >
        {operationLabel(fileOperation, 'export', 'Export', 'Exporting…')}
      </button>
      <button
        type="button"
        className="is-capture"
        disabled={fileBusy && !captureBusy}
        aria-expanded={activeMenu === 'capture'}
        data-ashfox-action="project.capture.open"
        onClick={() => onToggleMenu('capture')}
      >
        {operationLabel(fileOperation, 'capture', 'Capture', 'Capturing…')}
      </button>
      {artifactFile && artifactUrl ? (
        <a
          ref={artifactAnchorRef}
          className="artifact-download-action"
          href={artifactUrl}
          download={artifactFile.name}
          aria-label={`Download ${artifactFile.name}`}
          data-ashfox-action="artifact.download"
          data-ashfox-artifact-name={artifactFile.name}
          data-ashfox-artifact-content-type={artifactFile.contentType}
          data-ashfox-artifact-byte-length={artifactFile.bytes.byteLength}
          data-ashfox-artifact-project-id={artifactFile.projectId}
          data-ashfox-artifact-source-revision={artifactFile.sourceRevision}
          data-ashfox-artifact-target={artifactFile.target}
          data-ashfox-artifact-content-hash={artifactFile.contentHash}
        >
          <Icon name="download" />
        </a>
      ) : null}
    </div>
  );
}
