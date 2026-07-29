import type { MouseEvent } from 'react';

import type {
  AnimationClip,
  ProjectDocument
} from '@ashfox/engine-core';

import { Icon } from '../Icon';

interface AnimationTimelineProps {
  document: ProjectDocument;
  activeClip: AnimationClip | undefined;
  playhead: number;
  onSeek: (timeSeconds: number) => void;
  onSelectNode: (nodeId: string) => void;
}

const timelinePosition = (
  timeSeconds: number,
  durationSeconds: number,
  insetPixels: number
): string => {
  const percent = (timeSeconds / durationSeconds) * 100;
  return `clamp(${insetPixels}px, ${percent}%, calc(100% - ${insetPixels}px))`;
};

export function AnimationTimeline({
  document,
  activeClip,
  playhead,
  onSeek,
  onSelectNode
}: AnimationTimelineProps) {
  const duration = activeClip?.durationSeconds ?? 1;

  const seekFromPointer = (event: MouseEvent<HTMLDivElement>): void => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - bounds.left) / bounds.width)
    );
    onSeek(ratio * duration);
  };

  return (
    <div className="timeline-main">
      <div className="timeline-ruler" onClick={seekFromPointer}>
        {[0, 0.5, 1, 1.5, 2].map((time) => (
          <span
            key={time}
            style={{ left: timelinePosition(time, duration, 9) }}
          >
            {time.toFixed(1)}
          </span>
        ))}
      </div>
      <div className="timeline-tracks">
        {activeClip
          ? Object.values(activeClip.channels).map((channel) => {
              const node = document.scene.nodes[channel.targetNodeId];
              return (
                <div className="timeline-track" key={channel.id}>
                  <button
                    type="button"
                    className="track-label"
                    onClick={() => onSelectNode(channel.targetNodeId)}
                  >
                    <Icon name="key" />
                    <span>{node?.name ?? channel.targetNodeId}</span>
                    <small>{channel.property}</small>
                  </button>
                  <div className="key-lane" onClick={seekFromPointer}>
                    {channel.keys.map((key) => (
                      <button
                        type="button"
                        className="key-dot"
                        aria-label={`Keyframe at ${key.timeSeconds} seconds`}
                        key={key.id}
                        style={{
                          left: timelinePosition(
                            key.timeSeconds,
                            duration,
                            5
                          )
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSeek(key.timeSeconds);
                          onSelectNode(channel.targetNodeId);
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          : null}
        <div className="timeline-playhead-lane">
          <div
            className="timeline-playhead"
            style={{ left: timelinePosition(playhead, duration, 4) }}
          >
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}
