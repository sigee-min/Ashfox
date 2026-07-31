import {
  useEffect,
  useState,
  type FormEvent
} from 'react';

import {
  SURFACE_PIXEL_DENSITIES,
  type ProjectDocument,
  type SurfacePixelDensity
} from '@ashfox/engine-core';

import {
  editableProjectTargetFor,
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

const pixelSizeLabel = (
  density: SurfacePixelDensity
): string => {
  switch (density) {
    case 1:
      return '1 unit';
    case 2:
      return '½ unit';
    case 4:
      return '¼ unit';
  }
};

const coordinateLabel = (document: ProjectDocument): string => {
  const coordinate = document.settings.coordinateSystem;
  return `${coordinate.up.toUpperCase()} up · ${coordinate.handedness} · ${coordinate.unit}`;
};

export function ProjectSettingsMenu({
  document,
  onSave
}: ProjectSettingsMenuProps) {
  const hasCompiledModel =
    document.modeling?.authority === 'ashfox.part-compiler' ||
    Object.values(document.scene.nodes).some(
      (node) =>
        node.generation?.authority === 'ashfox.part-compiler'
    );
  const [name, setName] = useState(document.name);
  const [surfacePixelDensity, setSurfacePixelDensity] =
    useState(document.settings.surfacePixelDensity);
  const currentTarget = projectExportTargetFor(document);
  const currentEditableTarget = editableProjectTargetFor(document);
  const [target, setTarget] = useState(
    currentEditableTarget?.target ?? null
  );
  const [namespace, setNamespace] = useState(currentTarget.namespace);
  const [modelPath, setModelPath] = useState(currentTarget.modelPath);

  useEffect(() => {
    const nextTarget = projectExportTargetFor(document);
    const nextEditableTarget = editableProjectTargetFor(document);
    setName(document.name);
    setSurfacePixelDensity(
      document.settings.surfacePixelDensity
    );
    setTarget(nextEditableTarget?.target ?? null);
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
      trimmedNamespace !== currentEditableTarget.namespace ||
      trimmedModelPath !== currentEditableTarget.modelPath
    );
  const valid =
    trimmedName.length > 0 &&
    (
      target === null ||
      (
        trimmedModelPath.length > 0 &&
        (
          !isMinecraftExportTarget(target) ||
          trimmedNamespace.length > 0
        )
      )
    );
  const canSave =
    valid &&
    (
      trimmedName !== document.name ||
      surfacePixelDensity !==
        document.settings.surfacePixelDensity ||
      targetChanged
    );

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canSave) return;
    onSave({
      name: trimmedName,
      surfacePixelDensity,
      exportTarget:
        targetChanged && target !== null
          ? {
              target,
              namespace: trimmedNamespace || 'ashfox',
              modelPath: trimmedModelPath
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
        namespace={namespace}
        modelPath={modelPath}
        onTargetChange={setTarget}
        onNamespaceChange={setNamespace}
        onModelPathChange={setModelPath}
      />
      <fieldset className="surface-density-field">
        <legend>Surface detail</legend>
        <div className="surface-density-options">
          {SURFACE_PIXEL_DENSITIES.map((density) => (
            <label key={density}>
              <input
                type="radio"
                name="surface-pixel-density"
                value={density}
                checked={surfacePixelDensity === density}
                disabled={
                  hasCompiledModel &&
                  density !== document.settings.surfacePixelDensity
                }
                onChange={() => setSurfacePixelDensity(density)}
              />
              <strong>{density}×</strong>
              <span>{pixelSizeLabel(density)} pixel</span>
            </label>
          ))}
        </div>
        <p>
          {hasCompiledModel
            ? 'Surface detail is fixed after modeling starts.'
            : 'Smaller square pixels. Atlas size adjusts automatically.'}
        </p>
      </fieldset>
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
