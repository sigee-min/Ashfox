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

import type {
  ProjectSettingsInput
} from '../projectSettings';

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

  useEffect(() => {
    setName(document.name);
    setSurfacePixelDensity(
      document.settings.surfacePixelDensity
    );
  }, [document.name, document.settings.surfacePixelDensity]);

  const trimmedName = name.trim();
  const canSave =
    trimmedName.length > 0 &&
    (
      trimmedName !== document.name ||
      surfacePixelDensity !==
        document.settings.surfacePixelDensity
    );

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canSave) return;
    onSave({
      name: trimmedName,
      surfacePixelDensity
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
