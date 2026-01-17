import { SessionState } from '../session';

export function mergeSnapshots(session: SessionState, live: SessionState | null): SessionState {
  if (!live) return session;

  const useLiveAnimations = live.animationsStatus !== 'unavailable';
  const mergedAnimations = useLiveAnimations ? mergeAnimations(session.animations, live.animations) : session.animations;

  const merged: SessionState = {
    ...session,
    id: live.id ?? session.id,
    format: live.format ?? session.format,
    formatId: live.formatId ?? session.formatId,
    name: live.name ?? session.name,
    dirty: live.dirty ?? session.dirty,
    bones: live.bones,
    cubes: live.cubes,
    textures: live.textures,
    animations: mergedAnimations,
    animationsStatus: live.animationsStatus ?? session.animationsStatus
  };

  return merged;
}

function mergeAnimations(sessionAnims: SessionState['animations'], liveAnims: SessionState['animations']) {
  return liveAnims.map((live) => {
    const fallback = live.id
      ? sessionAnims.find((anim) => anim.id === live.id)
      : sessionAnims.find((anim) => anim.name === live.name);
    return {
      ...fallback,
      ...live,
      fps: live.fps ?? fallback?.fps,
      channels: live.channels ?? fallback?.channels
    };
  });
}
