import {
  useState,
  type FormEvent
} from 'react';

import type { NewProjectInput } from '../newProject';

interface NewProjectMenuProps {
  onCreate: (input: NewProjectInput) => void;
}

export function NewProjectMenu({
  onCreate
}: NewProjectMenuProps) {
  const [name, setName] = useState('Untitled project');

  const trimmedName = name.trim();
  const valid = trimmedName.length > 0;

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!valid) return;
    onCreate({
      name: trimmedName
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
        <span>Stored in this browser</span>
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
      <p className="new-project-note">
        After creating it, describe the asset in chat. The AI handles the
        build; you can watch, capture, download, or export the result here.
      </p>
      <button
        type="submit"
        className="popover-primary"
        data-ashfox-action="project.new.create"
        disabled={!valid}
      >
        Create project
      </button>
    </form>
  );
}
