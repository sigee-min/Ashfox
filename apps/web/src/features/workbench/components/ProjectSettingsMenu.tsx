import {
  useEffect,
  useState,
  type FormEvent
} from 'react';

import {
  PROJECT_TEXTURE_RESOLUTIONS,
  type ProjectDocument,
  type ProjectTextureResolution
} from '@ashfox/engine-core';

import type {
  ProjectSettingsInput
} from '../projectSettings';

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
  const currentResolution = document.settings.textureResolution;
  const resolutionOption = (
    currentResolution.width === currentResolution.height &&
    PROJECT_TEXTURE_RESOLUTIONS.includes(
      currentResolution.width as ProjectTextureResolution
    )
  )
    ? currentResolution.width as ProjectTextureResolution
    : null;
  const [resolution, setResolution] =
    useState<ProjectTextureResolution | null>(resolutionOption);

  useEffect(() => {
    setName(document.name);
    setResolution(resolutionOption);
  }, [document.name, resolutionOption]);

  const trimmedName = name.trim();
  const canSave =
    trimmedName.length > 0 &&
    (
      trimmedName !== document.name ||
      (
        resolution !== null &&
        (
          resolution !== currentResolution.width ||
          resolution !== currentResolution.height
        )
      )
    );

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canSave) return;
    onSave({
      name: trimmedName,
      ...(resolution === null ? {} : { textureResolution: resolution })
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
      <label className="popover-field">
        <span>Texture canvas</span>
        <select
          aria-label="Project texture resolution"
          value={resolution ?? ''}
          onChange={(event) => setResolution(
            Number(event.target.value) as ProjectTextureResolution
          )}
        >
          {resolution === null ? (
            <option value="" disabled>
              {currentResolution.width} × {currentResolution.height}
            </option>
          ) : null}
          {PROJECT_TEXTURE_RESOLUTIONS.map((size) => (
            <option value={size} key={size}>
              {size} × {size}
            </option>
          ))}
        </select>
      </label>
      <div className="project-facts">
        <span>
          <small>Coordinates</small>
          <strong>{coordinateLabel(document)}</strong>
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
