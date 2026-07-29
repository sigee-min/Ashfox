import type { TransformControlsMode } from 'three/addons/controls/TransformControls.js';

import { Icon, type IconName } from '../Icon';
import type {
  CameraCommand,
  ViewportOptions
} from '../viewport/viewportTypes';

interface IconButtonProps {
  label: string;
  icon: IconName;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  shortcut?: string;
}

function IconButton({
  label,
  icon,
  active = false,
  disabled = false,
  onClick,
  shortcut
}: IconButtonProps) {
  return (
    <button
      className={`icon-button${active ? ' is-active' : ''}`}
      type="button"
      aria-label={label}
      title={`${label}${shortcut ? ` · ${shortcut}` : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  );
}

interface WorkbenchToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  transformMode: TransformControlsMode;
  snapEnabled: boolean;
  cameraMode: CameraCommand['mode'];
  viewportOptions: ViewportOptions;
  onUndo: () => void;
  onRedo: () => void;
  onGenerateMinecraftTexture: () => void;
  onTransformMode: (mode: TransformControlsMode) => void;
  onToggleSnap: () => void;
  onSetCamera: (mode: CameraCommand['mode']) => void;
  onToggleViewportOption: (option: keyof ViewportOptions) => void;
}

export function WorkbenchToolbar({
  canUndo,
  canRedo,
  transformMode,
  snapEnabled,
  cameraMode,
  viewportOptions,
  onUndo,
  onRedo,
  onGenerateMinecraftTexture,
  onTransformMode,
  onToggleSnap,
  onSetCamera,
  onToggleViewportOption
}: WorkbenchToolbarProps) {
  return (
    <div className="tool-strip">
      <div className="tool-group">
        <IconButton
          label="Undo"
          icon="undo"
          shortcut="⌘Z"
          disabled={!canUndo}
          onClick={onUndo}
        />
        <IconButton
          label="Redo"
          icon="redo"
          shortcut="⇧⌘Z"
          disabled={!canRedo}
          onClick={onRedo}
        />
      </div>
      <div className="tool-separator" />
      <div className="tool-group">
        <IconButton
          label="Generate Minecraft texture"
          icon="texture"
          onClick={onGenerateMinecraftTexture}
        />
      </div>
      <div className="tool-separator" />
      <div className="tool-group">
        <IconButton
          label="Move"
          icon="move"
          shortcut="W"
          active={transformMode === 'translate'}
          onClick={() => onTransformMode('translate')}
        />
        <IconButton
          label="Rotate"
          icon="rotate"
          shortcut="E"
          active={transformMode === 'rotate'}
          onClick={() => onTransformMode('rotate')}
        />
        <IconButton
          label="Scale"
          icon="scale"
          shortcut="R"
          active={transformMode === 'scale'}
          onClick={() => onTransformMode('scale')}
        />
      </div>
      <button
        type="button"
        className={`snap-control${snapEnabled ? ' is-active' : ''}`}
        onClick={onToggleSnap}
      >
        Snap <kbd>{snapEnabled ? '0.5' : 'Off'}</kbd>
      </button>
      <div className="toolbar-spacer" />
      <div className="view-label">View</div>
      <div className="camera-presets" aria-label="Camera presets">
        {(
          [
            ['perspective', 'P'],
            ['front', 'F'],
            ['side', 'S'],
            ['top', 'T']
          ] as const
        ).map(([mode, label]) => (
          <button
            type="button"
            className={cameraMode === mode ? 'is-active' : ''}
            key={mode}
            title={`${mode} camera`}
            onClick={() => onSetCamera(mode)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="tool-separator" />
      <div className="tool-group">
        <IconButton
          label="Grid"
          icon="grid"
          active={viewportOptions.showGrid}
          onClick={() => onToggleViewportOption('showGrid')}
        />
        <IconButton
          label="Wireframe"
          icon="wire"
          active={viewportOptions.showWireframe}
          onClick={() => onToggleViewportOption('showWireframe')}
        />
        <IconButton
          label="Skeleton"
          icon="bone"
          active={viewportOptions.showSkeleton}
          onClick={() => onToggleViewportOption('showSkeleton')}
        />
      </div>
    </div>
  );
}
