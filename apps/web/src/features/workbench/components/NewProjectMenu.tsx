import {
  useState,
  type FormEvent
} from 'react';

import {
  PROJECT_EXPORT_TARGETS,
  type VisibleExportPreset
} from '../../../application/projectExportTarget';
import type { NewProjectInput } from '../newProject';

interface NewProjectMenuProps {
  onCreate: (input: NewProjectInput) => void;
}

export function NewProjectMenu({
  onCreate
}: NewProjectMenuProps) {
  const [name, setName] = useState('Untitled project');
  const [target, setTarget] = useState<VisibleExportPreset>('glb');

  const trimmedName = name.trim();
  const valid = trimmedName.length > 0;

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!valid) return;
    onCreate({
      name: trimmedName,
      target
    });
  };

  return (
    <form
      className="header-popover new-project-menu"
      aria-label="Create project"
      data-ashfox-surface="project.new"
      onSubmit={submit}
    >
      <div className="popover-heading">
        <strong>New project</strong>
        <span>Local · empty canvas</span>
      </div>
      <label className="popover-field">
        <span>Name</span>
        <input
          aria-label="New project name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div
        className="export-target-list"
        role="radiogroup"
        aria-label="Format"
      >
        {PROJECT_EXPORT_TARGETS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={target === option.id}
            className={target === option.id ? 'is-selected' : ''}
            onClick={() => setTarget(option.id)}
          >
            <strong>{option.label}</strong>
            <small>{option.detail}</small>
          </button>
        ))}
      </div>
      <p className="new-project-note">
        Your current project remains in local browser storage.
      </p>
      <button
        type="submit"
        className="popover-primary"
        data-ashfox-action="project.new.create"
        disabled={!valid}
      >
        Create {PROJECT_EXPORT_TARGETS.find(
          (option) => option.id === target
        )?.label ?? target} project
      </button>
    </form>
  );
}
