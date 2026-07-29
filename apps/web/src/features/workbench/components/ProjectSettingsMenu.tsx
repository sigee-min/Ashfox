import {
  useEffect,
  useState,
  type FormEvent
} from 'react';

import type { ProjectDocument } from '@ashfox/engine-core';

interface ProjectSettingsMenuProps {
  document: ProjectDocument;
  onRename: (name: string) => void;
}

const coordinateLabel = (document: ProjectDocument): string => {
  const coordinate = document.settings.coordinateSystem;
  return `${coordinate.up.toUpperCase()} up · ${coordinate.handedness} · ${coordinate.unit}`;
};

export function ProjectSettingsMenu({
  document,
  onRename
}: ProjectSettingsMenuProps) {
  const [name, setName] = useState(document.name);

  useEffect(() => setName(document.name), [document.name]);

  const trimmedName = name.trim();
  const canSave =
    trimmedName.length > 0 && trimmedName !== document.name;

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canSave) return;
    onRename(trimmedName);
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
      <div className="project-facts">
        <span>
          <small>Texture canvas</small>
          <strong>
            {document.settings.textureResolution.width} ×{' '}
            {document.settings.textureResolution.height}
          </strong>
        </span>
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
