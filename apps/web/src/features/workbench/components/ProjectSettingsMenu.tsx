import {
  useEffect,
  useState,
  type FormEvent
} from 'react';

import {
  isExportModelPathValid,
  isExportNamespaceValid,
  normalizeExportModelPath,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  editableProjectTargetFor,
  defaultProjectGameVersionFor,
  isMinecraftExportTarget,
  projectExportTargetFor
} from '../../../application/projectExportTarget';
import type {
  ProjectSettingsInput
} from '../projectSettings';
import { ProjectTargetFields } from './ProjectTargetFields';

interface ProjectSettingsMenuProps {
  document: ProjectDocument;
  onSave: (input: ProjectSettingsInput) => void;
}

const coordinateLabel = (document: ProjectDocument): string => {
  const coordinate = document.settings.coordinateSystem;
  return `${coordinate.up.toUpperCase()} up · ${coordinate.handedness} · ${coordinate.unit}`;
};

export function ProjectSettingsMenu({
  document,
  onSave
}: ProjectSettingsMenuProps) {
  const [name, setName] = useState(document.name);
  const currentTarget = projectExportTargetFor(document);
  const currentEditableTarget = editableProjectTargetFor(document);
  const [target, setTarget] = useState(
    currentEditableTarget?.target ?? null
  );
  const [gameVersion, setGameVersion] = useState(
    currentEditableTarget?.gameVersion ??
    defaultProjectGameVersionFor(currentEditableTarget?.target ?? null)
  );
  const [namespace, setNamespace] = useState(currentTarget.namespace);
  const [modelPath, setModelPath] = useState(currentTarget.modelPath);

  useEffect(() => {
    const nextTarget = projectExportTargetFor(document);
    const nextEditableTarget = editableProjectTargetFor(document);
    setName(document.name);
    setTarget(nextEditableTarget?.target ?? null);
    setGameVersion(
      nextEditableTarget?.gameVersion ??
      defaultProjectGameVersionFor(nextEditableTarget?.target ?? null)
    );
    setNamespace(nextTarget.namespace);
    setModelPath(nextTarget.modelPath);
  }, [document]);

  const trimmedName = name.trim();
  const trimmedNamespace = namespace.trim();
  const trimmedModelPath = modelPath.trim();
  const targetChanged =
    target !== null &&
    (
      currentEditableTarget === null ||
      target !== currentEditableTarget.target ||
      gameVersion !== currentEditableTarget.gameVersion ||
      trimmedNamespace !== currentEditableTarget.namespace ||
      trimmedModelPath !== currentEditableTarget.modelPath
    );
  const valid =
    trimmedName.length > 0 &&
    (
      target === null ||
      (
        isExportModelPathValid(target, trimmedModelPath) &&
        (
          !isMinecraftExportTarget(target) ||
          (
            gameVersion !== null &&
            isExportNamespaceValid(target, trimmedNamespace)
          )
        )
      )
    );
  const canSave =
    valid &&
    (
      trimmedName !== document.name ||
      targetChanged
    );

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canSave) return;
    onSave({
      name: trimmedName,
      surfacePixelDensity: document.settings.surfacePixelDensity,
      exportTarget:
        targetChanged && target !== null
          ? {
              target,
              namespace: trimmedNamespace || 'ashfox',
              modelPath: trimmedModelPath,
              gameVersion:
                isMinecraftExportTarget(target)
                  ? gameVersion
                  : null
            }
          : null
    });
  };

  return (
    <form
      className="header-popover project-settings-menu"
      aria-label="Project settings"
      onSubmit={submit}
    >
      <div className="popover-heading">
        <strong>Project settings</strong>
        <span>{document.id}</span>
      </div>
      <label className="popover-field">
        <span>Name</span>
        <input
          aria-label="Project name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <ProjectTargetFields
        target={target}
        gameVersion={gameVersion}
        namespace={namespace}
        modelPath={modelPath}
        onTargetChange={(nextTarget) => {
          setTarget(nextTarget);
          setGameVersion(defaultProjectGameVersionFor(nextTarget));
          setModelPath(normalizeExportModelPath(nextTarget, modelPath));
        }}
        onGameVersionChange={setGameVersion}
        onNamespaceChange={setNamespace}
        onModelPathChange={setModelPath}
      />
      <div className="iconic-style-card" aria-label="Authoring style">
        <strong>Iconic pixel · locked</strong>
        <span>
          {document.settings.surfacePixelDensity === 1
            ? '1-unit form grid · compact semantic decomposition'
            : `${document.settings.surfacePixelDensity}× legacy grid · rebuild at 1× for iconic authoring`}
        </span>
      </div>
      <div className="project-facts">
        <span>
          <small>Coordinates</small>
          <strong>{coordinateLabel(document)}</strong>
        </span>
        <span>
          <small>Generated atlas</small>
          <strong>
            {document.settings.textureResolution.width}
            {' × '}
            {document.settings.textureResolution.height}
          </strong>
        </span>
      </div>
      <button
        type="submit"
        className="popover-primary"
        disabled={!canSave}
      >
        Save settings
      </button>
    </form>
  );
}
