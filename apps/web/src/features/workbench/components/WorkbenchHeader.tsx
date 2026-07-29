import { useEffect, useRef, useState } from 'react';

import type {
  CommandReceipt,
  ProjectDocument
} from '@ashfox/engine-core';

import type { ArtifactFile } from '../../files/artifactFile';
import type { FileOperationState } from '../../files/fileOperationState';
import { useArtifactUrl } from '../../files/useArtifactUrl';
import type { GifCaptureFile } from '../../capture/gifCaptureFile';
import type { GifCaptureRequest } from '../../capture/gifCaptureRequest';
import { Icon } from '../Icon';
import type { ProjectExportTarget } from '../presentation/projectExportTarget';
import type { CameraMode } from '../viewport/cameraPresets';
import type { ViewportEnvironmentId } from '../viewport/viewportEnvironment';
import { BrandLogo } from './BrandLogo';
import { CaptureMenu } from './CaptureMenu';
import { ExportMenu } from './ExportMenu';
import { NewProjectMenu } from './NewProjectMenu';
import { ProjectSettingsMenu } from './ProjectSettingsMenu';
import type { NewProjectInput } from '../newProject';
import type { ProjectSettingsInput } from '../projectSettings';

type HeaderMenu = 'new' | 'project' | 'export' | 'capture' | null;

interface WorkbenchHeaderProps {
  document: ProjectDocument;
  fileOperation: FileOperationState<ArtifactFile>;
  artifactFile: ArtifactFile | null;
  buildDocuments: readonly ProjectDocument[];
  activity: readonly CommandReceipt[];
  activeClipId: string | null;
  environment: ViewportEnvironmentId;
  cameraMode: CameraMode;
  captureFile: GifCaptureFile | null;
  onCreateProject: (input: NewProjectInput) => void;
  onOpen: (file: File) => void;
  onSave: () => void;
  onUpdateProject: (input: ProjectSettingsInput) => void;
  onExport: (target: ProjectExportTarget) => void;
  onActiveClipChange: (clipId: string | null) => void;
  onCapture: (request: GifCaptureRequest) => void;
  onCancelFileOperation: () => void;
}

const targetLabel = (
  document: ProjectDocument
): readonly [string, string] => {
  switch (document.formatProfile.id) {
    case 'ashfox.generic':
      return ['ashfox', 'JSON'];
    case 'minecraft.java_block':
      return ['Java', document.formatProfile.modelKind];
    case 'minecraft.bedrock':
      return ['Bedrock', document.formatProfile.geometryKind];
    case 'minecraft.java.geckolib5':
      return ['GeckoLib 5', document.formatProfile.assetKind];
    case 'gltf.2':
      return [
        document.formatProfile.container.toUpperCase(),
        document.formatProfile.imageStorage
      ];
  }
};

export function WorkbenchHeader({
  document,
  fileOperation,
  artifactFile,
  buildDocuments,
  activity,
  activeClipId,
  environment,
  cameraMode,
  captureFile,
  onCreateProject,
  onOpen,
  onSave,
  onUpdateProject,
  onExport,
  onActiveClipChange,
  onCapture,
  onCancelFileOperation
}: WorkbenchHeaderProps) {
  const [activeMenu, setActiveMenu] = useState<HeaderMenu>(null);
  const openInputRef = useRef<HTMLInputElement>(null);
  const artifactAnchorRef = useRef<HTMLAnchorElement>(null);
  const artifactUrl = useArtifactUrl(artifactFile);
  const target = targetLabel(document);
  const fileBusy = fileOperation.phase === 'running';
  const openLabel =
    fileBusy && fileOperation.kind === 'open' ? 'Opening…' : 'Open';
  const saveLabel =
    fileBusy && fileOperation.kind === 'save' ? 'Saving…' : 'Save';
  const exportLabel =
    fileBusy && fileOperation.kind === 'export' ? 'Exporting…' : 'Export';
  const captureBusy = fileBusy && fileOperation.kind === 'capture';
  const captureLabel = captureBusy ? 'Capturing…' : 'Capture';

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setActiveMenu(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const toggleMenu = (menu: Exclude<HeaderMenu, null>): void => {
    setActiveMenu((current) => current === menu ? null : menu);
  };

  return (
    <header className="app-header">
      <div className="brand-mark" aria-label="ashfox">
        <BrandLogo />
        <span>ashfox</span>
      </div>
      <div className="header-divider" />
      <button
        type="button"
        className="project-path project-settings-trigger"
        aria-expanded={activeMenu === 'project'}
        aria-label="Project settings"
        onClick={() => toggleMenu('project')}
      >
        <span className="muted">Projects</span>
        <Icon name="chevron" />
        <strong>{document.name}</strong>
      </button>
      <div className="header-spacer" />
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
          onClick={() => toggleMenu('new')}
        >
          New
        </button>
        <button
          type="button"
          disabled={fileBusy}
          data-ashfox-action="project.open"
          onClick={() => openInputRef.current?.click()}
        >
          {openLabel}
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
          {saveLabel}
        </button>
        <button
          type="button"
          className="is-primary"
          disabled={fileBusy}
          aria-expanded={activeMenu === 'export'}
          data-ashfox-action="project.export.open"
          onClick={() => toggleMenu('export')}
        >
          {exportLabel}
        </button>
        <button
          type="button"
          className="is-capture"
          disabled={fileBusy && !captureBusy}
          aria-expanded={activeMenu === 'capture'}
          data-ashfox-action="project.capture.open"
          onClick={() => toggleMenu('capture')}
        >
          {captureLabel}
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
          >
            <Icon name="download" />
          </a>
        ) : null}
      </div>
      <span
        className="file-notice"
        aria-live="polite"
        data-ashfox-file-message
      >
        {fileOperation.message}
      </span>
      <button
        type="button"
        className="target-badge"
        aria-label="Choose export format"
        aria-expanded={activeMenu === 'export'}
        onClick={() => toggleMenu('export')}
      >
        <span>{target[0]}</span>
        <span className="target-detail">{target[1]}</span>
      </button>
      {activeMenu === 'new' ? (
        <NewProjectMenu
          onCreate={(input) => {
            onCreateProject(input);
            setActiveMenu(null);
          }}
        />
      ) : null}
      {activeMenu === 'project' ? (
        <ProjectSettingsMenu
          document={document}
          onSave={(input) => {
            onUpdateProject(input);
            setActiveMenu(null);
          }}
        />
      ) : null}
      {activeMenu === 'export' ? (
        <ExportMenu
          document={document}
          busy={fileBusy}
          onExport={(nextTarget) => {
            onExport(nextTarget);
            setActiveMenu(null);
          }}
        />
      ) : null}
      {activeMenu === 'capture' ? (
        <CaptureMenu
          document={document}
          buildDocuments={buildDocuments}
          activity={activity}
          activeClipId={activeClipId}
          environment={environment}
          cameraMode={cameraMode}
          operation={fileOperation}
          captureFile={captureFile}
          onActiveClipChange={onActiveClipChange}
          onCapture={onCapture}
          onCancel={onCancelFileOperation}
          onDownload={() => artifactAnchorRef.current?.click()}
          canDownload={artifactUrl !== null}
        />
      ) : null}
    </header>
  );
}
