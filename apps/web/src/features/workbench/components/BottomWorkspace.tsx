import type {
  AnimationClip,
  CommandReceipt,
  ProjectDocument
} from '@ashfox/engine-core';

import { Icon } from '../Icon';
import type { StorageStatus } from '../persistence/useLocalProjectPersistence';
import type {
  BottomWorkspaceMode
} from '../state/workbenchViewState';
import { ActivityPanel } from './ActivityPanel';
import { AnimationTimeline } from './AnimationTimeline';

interface BottomWorkspaceProps {
  mode: BottomWorkspaceMode;
  document: ProjectDocument;
  activity: readonly CommandReceipt[];
  activeClipId: string | null;
  activeClip: AnimationClip | undefined;
  playhead: number;
  playing: boolean;
  storageStatus: StorageStatus;
  onModeChange: (mode: BottomWorkspaceMode) => void;
  onActiveClipChange: (clipId: string | null) => void;
  onTogglePlayback: () => void;
  onSeek: (timeSeconds: number) => void;
  onSelectNode: (nodeId: string) => void;
}

const formatTime = (value: number): string => value.toFixed(2);

export function BottomWorkspace({
  mode,
  document,
  activity,
  activeClipId,
  activeClip,
  playhead,
  playing,
  storageStatus,
  onModeChange,
  onActiveClipChange,
  onTogglePlayback,
  onSeek,
  onSelectNode
}: BottomWorkspaceProps) {
  const duration = activeClip?.durationSeconds ?? 0;

  return (
    <section className="timeline-panel">
      <div className="timeline-sidebar">
        <div className="bottom-workspace-switch" aria-label="Bottom workspace">
          <button
            type="button"
            className={mode === 'animation' ? 'is-active' : ''}
            onClick={() => onModeChange('animation')}
          >
            <Icon name="play" />
            <span>Animate</span>
          </button>
          <button
            type="button"
            className={mode === 'activity' ? 'is-active' : ''}
            onClick={() => onModeChange('activity')}
          >
            <Icon name="spark" />
            <span>Activity</span>
            <small>{activity.length}</small>
          </button>
        </div>
        {mode === 'animation' ? (
          <>
            <div className="timeline-controls">
              <button
                type="button"
                className="play-button"
                aria-label={playing ? 'Pause animation' : 'Play animation'}
                disabled={!activeClip}
                onClick={onTogglePlayback}
              >
                <Icon name={playing ? 'pause' : 'play'} />
              </button>
              <select
                aria-label="Animation clip"
                value={activeClipId ?? ''}
                onChange={(event) =>
                  onActiveClipChange(event.target.value || null)
                }
                disabled={Object.keys(document.animations).length === 0}
              >
                {Object.keys(document.animations).length === 0 ? (
                  <option value="">No clips</option>
                ) : null}
                {Object.values(document.animations).map((clip) => (
                  <option key={clip.id} value={clip.id}>{clip.name}</option>
                ))}
              </select>
            </div>
            <div className="timeline-time">
              <strong>{formatTime(playhead)}</strong>
              <span>/ {formatTime(duration)}s</span>
              <kbd>{activeClip?.fps ?? 0} fps</kbd>
            </div>
          </>
        ) : (
          <div className="activity-summary">
            <strong>
              {storageStatus === 'saved' ? 'Stored locally' : 'Repository busy'}
            </strong>
            <span>{document.revision}</span>
          </div>
        )}
      </div>
      {mode === 'animation' ? (
        <AnimationTimeline
          document={document}
          activeClip={activeClip}
          playhead={playhead}
          onSeek={onSeek}
          onSelectNode={onSelectNode}
        />
      ) : (
        <ActivityPanel
          activity={activity}
          onSelectNode={onSelectNode}
        />
      )}
    </section>
  );
}
