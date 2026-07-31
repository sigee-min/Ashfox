import { useEffect, useRef, useState } from 'react';

import {
  gameVersionForFormatProfile,
  type CommandReceipt,
  type ProjectDocument
} from '@ashfox/engine-core';

import type { ArtifactFile } from '../../files/artifactFile';
import type { FileOperationState } from '../../files/fileOperationState';
import { useArtifactUrl } from '../../files/useArtifactUrl';
import type { GifCaptureFile } from '../../capture/gifCaptureFile';
import type { GifCaptureRequest } from '../../capture/gifCaptureRequest';
import { Icon } from '../Icon';
import type { CameraMode } from '../../../rendering/cameraPresets';
import type { ViewportEnvironmentId } from '../../../rendering/viewportEnvironment';
import { BrandLogo } from './BrandLogo';
import { CaptureMenu } from './CaptureMenu';
import { ExportMenu } from './ExportMenu';
import { NewProjectMenu } from './NewProjectMenu';
import { ProjectSettingsMenu } from './ProjectSettingsMenu';
import type { NewProjectInput } from '../newProject';
import type { ProjectSettingsInput } from '../projectSettings';
import { HeaderFileActions } from './header/HeaderFileActions';
import type {
  HeaderMenu,
  OpenHeaderMenu
} from './header/headerMenu';

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
  onExport: () => void;
  onActiveClipChange: (clipId: string | null) => void;
  onCapture: (request: GifCaptureRequest) => void;
  onCancelFileOperation: () => void;
}

const targetLabel = (
  document: ProjectDocument
): readonly [string, string] => {
  const gameVersion = gameVersionForFormatProfile(
    document.formatProfile
  );
  switch (document.formatProfile.id) {
    case 'ashfox.generic':
      return ['ashfox', 'JSON'];
    case 'minecraft.java_block':
      return ['Java', gameVersion ?? document.formatProfile.modelKind];
    case 'minecraft.bedrock':
      return ['Bedrock', gameVersion ?? document.formatProfile.geometryKind];
    case 'minecraft.java.geckolib5':
      return ['GeckoLib 5', gameVersion ?? document.formatProfile.assetKind];
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

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setActiveMenu(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const toggleMenu = (menu: OpenHeaderMenu): void => {
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
      <HeaderFileActions
        activeMenu={activeMenu}
        fileOperation={fileOperation}
        artifactFile={artifactFile}
        artifactUrl={artifactUrl}
        openInputRef={openInputRef}
        artifactAnchorRef={artifactAnchorRef}
        onToggleMenu={toggleMenu}
        onOpen={onOpen}
        onSave={onSave}
      />
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
        aria-label="Export project target"
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
          onExport={() => {
            onExport();
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
