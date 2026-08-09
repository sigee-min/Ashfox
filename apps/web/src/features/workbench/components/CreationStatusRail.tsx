import type {
  CreationStatusViewModel
} from '../presentation/status';

interface CreationStatusRailProps {
  readonly status: CreationStatusViewModel;
}

export function CreationStatusRail({
  status
}: CreationStatusRailProps) {
  return (
    <div
      className={`creation-status-rail is-${status.state}`}
      aria-label="AI asset status"
      role="status"
    >
      <span className="creation-status-dot" />
      <strong>{status.label}</strong>
      <span className="creation-status-detail">{status.detail}</span>
      <span className={`autosave-status is-${status.autosaveState}`}>
        {status.autosaveLabel}
      </span>
    </div>
  );
}
