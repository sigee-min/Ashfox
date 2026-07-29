import { useEffect, useState } from 'react';

import type { ProjectDocument } from '@ashfox/engine-core';

import type { FileOperationState } from '../../files/fileOperationState';
import { Icon } from '../Icon';
import type { StorageStatus } from '../persistence/useLocalProjectPersistence';
import type { ProjectExportTarget } from '../presentation/projectExportTarget';
import { ExportMenu } from './ExportMenu';
import { ProjectSettingsMenu } from './ProjectSettingsMenu';

type HeaderMenu = 'project' | 'export' | null;

interface WorkbenchHeaderProps {
  document: ProjectDocument;
  isRendered: boolean;
  storageStatus: StorageStatus;
  lastSavedAt: string | null;
  fileOperation: FileOperationState;
  onOpen: () => void;
  onSave: () => void;
  onRenameProject: (name: string) => void;
  onExport: (target: ProjectExportTarget) => void;
}

const storageLabel = (status: StorageStatus): string => {
  switch (status) {
    case 'loading':
      return 'Loading';
    case 'saving':
      return 'Saving';
    case 'saved':
      return 'Local saved';
    case 'error':
      return 'Storage error';
  }
};

const targetLabel = (
  document: ProjectDocument
): readonly [string, string] => {
  switch (document.formatProfile.id) {
    case 'ashfox.generic':
      return ['Ashfox', 'JSON'];
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
  isRendered,
  storageStatus,
  lastSavedAt,
  fileOperation,
  onOpen,
  onSave,
  onRenameProject,
  onExport
}: WorkbenchHeaderProps) {
  const [activeMenu, setActiveMenu] = useState<HeaderMenu>(null);
  const storageTitle = lastSavedAt
    ? `Saved locally ${new Date(lastSavedAt).toLocaleTimeString()}`
    : 'Browser-local project storage';
  const target = targetLabel(document);
  const fileBusy = fileOperation.phase === 'running';
  const openLabel =
    fileBusy && fileOperation.kind === 'open' ? 'Opening…' : 'Open';
  const saveLabel =
    fileBusy && fileOperation.kind === 'save' ? 'Saving…' : 'Save';
  const exportLabel =
    fileBusy && fileOperation.kind === 'export' ? 'Exporting…' : 'Export';

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
      <div className="brand-mark" aria-label="Ashfox">
        <span className="brand-glyph"><Icon name="spark" /></span>
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
        <button type="button" disabled={fileBusy} onClick={onOpen}>
          {openLabel}
        </button>
        <button type="button" disabled={fileBusy} onClick={onSave}>
          {saveLabel}
        </button>
        <button
          type="button"
          className="is-primary"
          disabled={fileBusy}
          aria-expanded={activeMenu === 'export'}
          onClick={() => toggleMenu('export')}
        >
          {exportLabel}
        </button>
      </div>
      <span className="file-notice" aria-live="polite">
        {fileOperation.message}
      </span>
      <div className={`sync-state${isRendered ? ' is-live' : ''}`}>
        <span className="live-dot" />
        {isRendered ? 'Live preview' : 'Applying…'}
      </div>
      <div
        className={`storage-state is-${storageStatus}`}
        title={storageTitle}
      >
        <span className="storage-dot" />
        {storageLabel(storageStatus)}
      </div>
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
      <span className="revision-label">{document.revision}</span>
      {activeMenu === 'project' ? (
        <ProjectSettingsMenu
          document={document}
          onRename={(name) => {
            onRenameProject(name);
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
    </header>
  );
}
