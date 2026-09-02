import type {
  CaptureMenuControllerInput
} from '../../capture/controller';
import {
  useCaptureMenuController
} from '../../capture/controller';

type CaptureMenuProps = CaptureMenuControllerInput;

export function CaptureMenu(props: CaptureMenuProps) {
  const controller = useCaptureMenuController(props);
  const { view } = controller;

  return (
    <section
      className="header-popover capture-menu"
      aria-label="Build replay"
    >
      <div className="popover-heading">
        <strong>Build replay</strong>
        <span>{view.headingMeta}</span>
      </div>

      <div className="capture-summary">
        <span>{view.framesLabel}</span>
        <span>{view.eventsLabel}</span>
        <span>{view.cameraLabel}</span>
      </div>
      <p
        className={`capture-status${
          view.statusTone === 'error' ? ' is-error' : ''
        }`}
      >
        {view.statusMessage}
      </p>

      {view.capturing ? (
        <button
          type="button"
          className="popover-secondary"
          data-ashfox-action="project.capture.cancel"
          onClick={controller.cancel}
        >
          Cancel capture
        </button>
      ) : view.ready ? (
        <div className="capture-ready-actions">
          <button
            type="button"
            className="popover-primary capture-download-link"
            onClick={controller.download}
            disabled={view.downloadDisabled}
          >
            Download GIF
          </button>
          <button
            type="button"
            className="popover-secondary"
            data-ashfox-action="project.capture.start"
            disabled={view.startDisabled}
            onClick={controller.start}
          >
            {view.startLabel}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="popover-primary"
          data-ashfox-action="project.capture.start"
          disabled={view.startDisabled}
          onClick={controller.start}
        >
          {view.startLabel}
        </button>
      )}
    </section>
  );
}
