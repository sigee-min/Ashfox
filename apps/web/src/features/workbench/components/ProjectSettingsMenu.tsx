import {
  useEffect,
  useState,
  type FormEvent
} from 'react';

import {
  type ProjectDocument
} from '@ashfox/engine-core';

import type {
  ProjectSettingsInput
} from '../projectSettings';

interface ProjectSettingsMenuProps {
  document: ProjectDocument;
  onSave: (input: ProjectSettingsInput) => void;
}

export function ProjectSettingsMenu({
  document,
  onSave
}: ProjectSettingsMenuProps) {
  const [name, setName] = useState(document.name);

  useEffect(() => {
    setName(document.name);
  }, [document]);

  const trimmedName = name.trim();
  const canSave =
    trimmedName.length > 0 &&
    trimmedName !== document.name;
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canSave) return;
    onSave({
      name: trimmedName
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
      <div className="iconic-style-card" aria-label="Authoring style">
        <strong>Intent Program · compiler owned</strong>
        <span>
          Form, symmetry, stance, facial structure, and surface detail come from the confirmed program.
        </span>
      </div>
      <div className="project-facts">
        <span>
          <small>Program</small>
          <strong>
            {document.intentProgram
              ? `Confirmed · ${document.intentProgram.hash.slice(0, 10)}`
              : 'Not confirmed'}
          </strong>
        </span>
      </div>
      {document.intentProgram && (
        <details className="confirmed-intent-program">
          <summary>Confirmed Intent Program</summary>
          <p>
            This source is the authority for the generated asset. Ask for a new
            program when you want to revise the asset; coordinates are never
            edited here.
          </p>
          <pre>{document.intentProgram.source}</pre>
        </details>
      )}
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
