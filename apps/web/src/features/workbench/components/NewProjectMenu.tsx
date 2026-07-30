import {
  useState,
  type FormEvent
} from 'react';

import {
  isMinecraftExportTarget,
  PROJECT_EXPORT_TARGETS,
  projectResourceToken,
  type VisibleExportPreset
} from '../presentation/projectExportTarget';
import type { NewProjectInput } from '../newProject';
import { ProjectTargetFields } from './ProjectTargetFields';

interface NewProjectMenuProps {
  onCreate: (input: NewProjectInput) => void;
}

export function NewProjectMenu({
  onCreate
}: NewProjectMenuProps) {
  const [name, setName] = useState('Untitled project');
  const [target, setTarget] = useState<VisibleExportPreset>('glb');
  const [namespace, setNamespace] = useState('ashfox');
  const [modelPath, setModelPath] = useState('untitled_project');
  const [modelPathEdited, setModelPathEdited] = useState(false);

  const trimmedName = name.trim();
  const trimmedNamespace = namespace.trim();
  const trimmedModelPath = modelPath.trim();
  const valid =
    trimmedName.length > 0 &&
    trimmedModelPath.length > 0 &&
    (
      !isMinecraftExportTarget(target) ||
      trimmedNamespace.length > 0
    );

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!valid) return;
    onCreate({
      name: trimmedName,
      target,
      namespace: trimmedNamespace || 'ashfox',
      modelPath: trimmedModelPath
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
          onChange={(event) => {
            const nextName = event.target.value;
            setName(nextName);
            if (!modelPathEdited) {
              setModelPath(projectResourceToken(nextName));
            }
          }}
        />
      </label>
      <ProjectTargetFields
        target={target}
        namespace={namespace}
        modelPath={modelPath}
        onTargetChange={setTarget}
        onNamespaceChange={setNamespace}
        onModelPathChange={(nextModelPath) => {
          setModelPath(nextModelPath);
          setModelPathEdited(true);
        }}
      />
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
