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
      aria-label="Capture GIF"
    >
      <div className="popover-heading">
        <strong>Capture GIF</strong>
        <span>{view.headingMeta}</span>
      </div>

      <div
        className="capture-mode-switch"
        role="tablist"
        aria-label="Capture mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view.mode === 'build'}
          className={view.mode === 'build' ? 'is-active' : ''}
          disabled={view.capturing}
          onClick={() => controller.selectMode('build')}
        >
          Build process
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view.mode === 'animation'}
          className={view.mode === 'animation' ? 'is-active' : ''}
          disabled={view.capturing}
          onClick={() => controller.selectMode('animation')}
        >
          Animation
        </button>
      </div>

      {view.showAnimationPicker ? (
        <label className="popover-field">
          <span>Animation</span>
          <select
            aria-label="Capture animation"
            value={view.activeClipId}
            disabled={view.capturing}
            onChange={(event) =>
              controller.selectClip(event.target.value || null)}
          >
            {view.clips.length === 0 ? (
              <option value="">No animation clips</option>
            ) : null}
            {view.clips.map((clip) => (
              <option key={clip.id} value={clip.id}>
                {clip.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

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
