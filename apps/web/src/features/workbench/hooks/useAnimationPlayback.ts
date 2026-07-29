'use client';

import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react';

import type { AnimationClip } from '@ashfox/engine-core';

interface AnimationPlayback {
  playhead: number;
  setPlayhead: Dispatch<SetStateAction<number>>;
  playing: boolean;
  setPlaying: Dispatch<SetStateAction<boolean>>;
}

export const useAnimationPlayback = (
  activeClip: AnimationClip | undefined
): AnimationPlayback => {
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!activeClip || activeClip.durationSeconds <= 0) {
      setPlaying(false);
      setPlayhead(0);
      return;
    }
    setPlayhead((current) =>
      Math.min(current, activeClip.durationSeconds)
    );
  }, [activeClip?.durationSeconds, activeClip?.id]);

  useEffect(() => {
    if (!playing || !activeClip) return;
    let animationFrame = 0;
    let previous = performance.now();

    const advance = (now: number): void => {
      const delta = Math.min(0.1, (now - previous) / 1000);
      previous = now;
      setPlayhead((current) => {
        const next = current + delta;
        if (activeClip.loop === 'loop') {
          return next % activeClip.durationSeconds;
        }
        if (next >= activeClip.durationSeconds) {
          setPlaying(false);
          return activeClip.durationSeconds;
        }
        return next;
      });
      animationFrame = requestAnimationFrame(advance);
    };

    animationFrame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(animationFrame);
  }, [activeClip, playing]);

  return {
    playhead,
    setPlayhead,
    playing,
    setPlaying
  };
};
