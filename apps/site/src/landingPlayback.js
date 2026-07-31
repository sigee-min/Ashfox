const MEDIA_READY_TIMEOUT_MS = 8_000;
const PLAY_START_TIMEOUT_MS = 2_000;
const STORY_SETTLE_MS = 110;
const STORY_HYSTERESIS_PX = 48;

const wait = (duration, signal) => new Promise((resolve) => {
  if (signal.aborted) {
    resolve(false);
    return;
  }
  const timer = window.setTimeout(() => finish(true), duration);
  const onAbort = () => finish(false);
  const finish = (completed) => {
    window.clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
    resolve(completed);
  };
  signal.addEventListener('abort', onAbort, { once: true });
});

const waitForPlaybackEnd = (video, signal) => new Promise((resolve) => {
  if (signal.aborted) {
    resolve(false);
    return;
  }
  if (video.ended) {
    resolve(true);
    return;
  }
  const finish = (completed) => {
    video.removeEventListener('ended', onEnded);
    video.removeEventListener('error', onError);
    signal.removeEventListener('abort', onAbort);
    resolve(completed);
  };
  const onEnded = () => finish(true);
  const onError = () => finish(false);
  const onAbort = () => finish(false);
  video.addEventListener('ended', onEnded, { once: true });
  video.addEventListener('error', onError, { once: true });
  signal.addEventListener('abort', onAbort, { once: true });
});

const withTimeout = (promise, duration) => new Promise((resolve, reject) => {
  const timer = window.setTimeout(
    () => reject(new Error('Media playback timed out.')),
    duration
  );
  Promise.resolve(promise).then(
    (value) => {
      window.clearTimeout(timer);
      resolve(value);
    },
    (error) => {
      window.clearTimeout(timer);
      reject(error);
    }
  );
});

const createPlaybackAuthority = () => {
  const stops = new Map();
  let activeOwner = null;

  return {
    claim(owner) {
      if (activeOwner === owner) return;
      const previousOwner = activeOwner;
      activeOwner = owner;
      stops.get(previousOwner)?.();
    },
    register(owner, stop) {
      stops.set(owner, stop);
      return () => stops.delete(owner);
    },
    release(owner) {
      if (activeOwner === owner) activeOwner = null;
    }
  };
};

const createVideoPlayer = ({ authority, owner, root, video }) => {
  let cancelPendingLoad = null;
  let requestId = 0;

  const setState = (state) => {
    root.dataset.mediaState = state;
    video.dataset.mediaState = state;
  };

  const clearSource = () => {
    video.pause();
    if (video.hasAttribute('src')) {
      video.removeAttribute('src');
      video.load();
    }
    delete video.dataset.videoSrc;
  };

  const stop = () => {
    requestId += 1;
    cancelPendingLoad?.();
    cancelPendingLoad = null;
    clearSource();
    setState('poster');
    authority.release(owner);
  };

  const load = (source, activeRequest) => new Promise((resolve) => {
    let settled = false;
    const finish = (loaded) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('error', onError);
      if (cancelPendingLoad === cancel) cancelPendingLoad = null;
      resolve(loaded && activeRequest === requestId);
    };
    const onLoaded = () => finish(true);
    const onError = () => finish(false);
    const cancel = () => finish(false);
    const timeout = window.setTimeout(
      () => finish(false),
      MEDIA_READY_TIMEOUT_MS
    );
    cancelPendingLoad = cancel;
    video.addEventListener('loadeddata', onLoaded, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.src = source;
    video.dataset.videoSrc = source;
    video.load();
  });

  const play = async (source) => {
    const activeRequest = requestId + 1;
    requestId = activeRequest;
    cancelPendingLoad?.();
    cancelPendingLoad = null;
    clearSource();
    authority.claim(owner);
    setState('loading');

    const loaded = await load(source, activeRequest);
    if (!loaded) {
      if (activeRequest === requestId) {
        clearSource();
        setState('error');
        authority.release(owner);
      }
      return false;
    }

    try {
      video.currentTime = 0;
      setState('ready');
      await withTimeout(video.play(), PLAY_START_TIMEOUT_MS);
      if (activeRequest !== requestId) {
        video.pause();
        return false;
      }
      setState('playing');
      return true;
    } catch {
      if (activeRequest === requestId) {
        clearSource();
        setState('error');
        authority.release(owner);
      }
      return false;
    }
  };

  const onEnded = () => {
    if (video.dataset.mediaState !== 'playing') return;
    setState('ended');
    authority.release(owner);
  };
  video.addEventListener('ended', onEnded);

  setState('poster');
  return {
    destroy() {
      stop();
      video.removeEventListener('ended', onEnded);
    },
    play,
    stop
  };
};

const parseSequences = (element) => {
  try {
    const parsed = JSON.parse(element.dataset.sequences ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const initializeHeroDemo = ({ authority, prefersReducedMotion }) => {
  const demo = document.querySelector('[data-agent-demo]');
  if (!(demo instanceof HTMLElement)) return () => {};
  const input = demo.querySelector('[data-demo-input]');
  const poster = demo.querySelector('[data-demo-poster]');
  const viewport = demo.querySelector('[data-demo-viewport]');
  const video = demo.querySelector('[data-demo-player]');
  const sequences = parseSequences(demo);
  if (
    !(input instanceof HTMLTextAreaElement) ||
    !(poster instanceof HTMLImageElement) ||
    !(viewport instanceof HTMLElement) ||
    !(video instanceof HTMLVideoElement) ||
    sequences.length === 0
  ) {
    return () => {};
  }

  const owner = 'hero';
  const player = createVideoPlayer({ authority, owner, root: demo, video });
  let sequenceIndex = 0;
  let runController = null;
  let visible = false;
  let observer = null;

  const sequenceAt = (index) => sequences[index % sequences.length];
  const setPoster = (source, label) => {
    poster.src = source;
    viewport.setAttribute('aria-label', label);
  };

  const showRestingState = () => {
    const sequence = sequenceAt(sequenceIndex);
    player.stop();
    demo.dataset.busy = 'false';
    demo.dataset.demo = sequence.name;
    demo.dataset.stage = 'paused';
    input.value = sequence.prompt;
    setPoster(sequence.poster, `${sequence.name} completed in ashfox`);
  };

  const cancelRun = () => {
    runController?.abort();
    runController = null;
    showRestingState();
  };
  const unregister = authority.register(owner, cancelRun);

  const run = async (signal) => {
    while (!signal.aborted) {
      const sequence = sequenceAt(sequenceIndex);
      player.stop();
      demo.dataset.busy = 'false';
      demo.dataset.demo = sequence.name;
      demo.dataset.stage = 'typing';
      input.value = '';
      setPoster(
        demo.dataset.emptySrc,
        `Empty ashfox scene prepared for ${sequence.name}`
      );

      if (!(await wait(450, signal))) return;
      for (let index = 1; index <= sequence.prompt.length; index += 1) {
        input.value = sequence.prompt.slice(0, index);
        if (!(await wait(22, signal))) return;
      }
      if (!(await wait(420, signal))) return;

      demo.dataset.busy = 'true';
      demo.dataset.stage = 'loading';
      const started = await player.play(sequence.video);
      if (signal.aborted) return;
      if (!started) {
        demo.dataset.busy = 'false';
        demo.dataset.stage = 'error';
        setPoster(sequence.poster, `${sequence.name} completed in ashfox`);
      } else {
        demo.dataset.stage = 'playing';
        if (!(await waitForPlaybackEnd(video, signal))) return;
        demo.dataset.busy = 'false';
        demo.dataset.stage = 'cooldown';
      }

      if (!(await wait(sequence.cooldownMs, signal))) return;
      sequenceIndex = (sequenceIndex + 1) % sequences.length;
    }
  };

  const syncRunState = () => {
    const shouldRun = visible && !document.hidden && !prefersReducedMotion;
    if (!shouldRun) {
      if (runController) cancelRun();
      return;
    }
    if (runController) return;
    runController = new AbortController();
    const activeController = runController;
    run(activeController.signal).finally(() => {
      if (runController === activeController) runController = null;
    });
  };

  if (prefersReducedMotion) {
    showRestingState();
  } else if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry && entry.intersectionRatio >= 0.18);
      syncRunState();
    }, { threshold: [0, 0.18] });
    observer.observe(demo);
  } else {
    visible = true;
    syncRunState();
  }

  const onVisibilityChange = () => syncRunState();
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    runController?.abort();
    observer?.disconnect();
    player.destroy();
    unregister();
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
};

export const selectStoryChapter = (
  rectangles,
  viewportHeight,
  currentIndex = -1,
  hysteresis = STORY_HYSTERESIS_PX
) => {
  const viewportCenter = viewportHeight / 2;
  const visible = rectangles
    .map((rectangle, index) => ({
      distance: Math.abs((rectangle.top + rectangle.bottom) / 2 - viewportCenter),
      index,
      rectangle
    }))
    .filter(({ rectangle }) =>
      rectangle.bottom > 0 && rectangle.top < viewportHeight
    );
  if (visible.length === 0) return -1;
  visible.sort((left, right) => left.distance - right.distance);
  const closest = visible[0];
  const current = visible.find(({ index }) => index === currentIndex);
  if (current && current.distance <= closest.distance + hysteresis) {
    return currentIndex;
  }
  return closest.index;
};

const initializeStory = ({ authority, prefersReducedMotion }) => {
  const story = document.querySelector('[data-scroll-story]');
  if (!(story instanceof HTMLElement)) return () => {};
  const chapters = [...story.querySelectorAll('[data-story-chapter]')];
  const mobileHosts = [...story.querySelectorAll('[data-story-mobile-host]')];
  const desktopHost = story.querySelector('[data-story-desktop-host]');
  const desktopPoster = story.querySelector('[data-story-desktop-poster]');
  const position = story.querySelector('[data-story-position]');
  const video = story.querySelector('[data-story-player]');
  const sequences = parseSequences(story);
  if (
    !(desktopHost instanceof HTMLElement) ||
    !(desktopPoster instanceof HTMLImageElement) ||
    !(video instanceof HTMLVideoElement) ||
    sequences.length !== chapters.length ||
    mobileHosts.length !== chapters.length
  ) {
    return () => {};
  }

  const owner = 'story';
  const player = createVideoPlayer({ authority, owner, root: story, video });
  const mobileLayout = window.matchMedia('(max-width: 900px)');
  let activeIndex = -1;
  let candidateIndex = -1;
  let evaluationFrame = 0;
  let settleTimer = 0;
  let sectionVisible = false;
  let playbackRequest = 0;
  let observer = null;

  const movePlayer = (index) => {
    const target = mobileLayout.matches ? mobileHosts[index] : desktopHost;
    if (target instanceof HTMLElement && video.parentElement !== target) {
      target.append(video);
    }
  };

  const setActiveChapter = (index) => {
    activeIndex = index;
    story.dataset.activeIndex = String(index);
    story.style.setProperty(
      '--story-progress',
      String((index + 1) / chapters.length)
    );
    for (const [chapterIndex, chapter] of chapters.entries()) {
      chapter.dataset.active = String(chapterIndex === index);
    }
    if (position instanceof HTMLElement) {
      position.textContent = `0${index + 1} / 0${chapters.length}`;
    }
  };

  const playChapter = async (index, force = false) => {
    if (!sequences[index]) return;
    if (!force && activeIndex === index && video.dataset.mediaState !== 'poster') {
      return;
    }
    const request = playbackRequest + 1;
    playbackRequest = request;
    const sequence = sequences[index];
    setActiveChapter(index);
    desktopPoster.src = sequence.poster;
    desktopHost.setAttribute('aria-label', sequence.alt);
    movePlayer(index);
    const started = await player.play(sequence.video);
    if (request !== playbackRequest || !started) return;
    story.dataset.videoSrc = sequence.video;
  };

  const stopPlayback = () => {
    playbackRequest += 1;
    window.clearTimeout(settleTimer);
    settleTimer = 0;
    player.stop();
    delete story.dataset.videoSrc;
  };
  const unregister = authority.register(owner, stopPlayback);

  const selectCurrentChapter = () => selectStoryChapter(
    chapters.map((chapter) => chapter.getBoundingClientRect()),
    window.innerHeight,
    activeIndex
  );

  const settleChapter = (index) => {
    if (index < 0) return;
    if (
      index === activeIndex &&
      video.dataset.mediaState !== 'poster' &&
      video.dataset.mediaState !== 'error'
    ) {
      return;
    }
    if (index === candidateIndex && settleTimer) return;
    candidateIndex = index;
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      settleTimer = 0;
      const latestIndex = selectCurrentChapter();
      if (
        latestIndex === candidateIndex &&
        sectionVisible &&
        !document.hidden
      ) {
        playChapter(latestIndex, latestIndex === activeIndex);
      }
    }, STORY_SETTLE_MS);
  };

  const evaluate = () => {
    evaluationFrame = 0;
    if (!sectionVisible || document.hidden || prefersReducedMotion) return;
    settleChapter(selectCurrentChapter());
  };

  const scheduleEvaluation = () => {
    if (evaluationFrame) return;
    evaluationFrame = window.requestAnimationFrame(evaluate);
  };

  const onLayoutChange = () => {
    if (activeIndex >= 0) movePlayer(activeIndex);
    scheduleEvaluation();
  };
  const onVisibilityChange = () => {
    if (document.hidden) stopPlayback();
    else scheduleEvaluation();
  };

  setActiveChapter(0);
  if (prefersReducedMotion) {
    desktopPoster.src = sequences[0].poster;
    desktopHost.setAttribute('aria-label', sequences[0].alt);
  } else {
    window.addEventListener('scroll', scheduleEvaluation, { passive: true });
    window.addEventListener('resize', onLayoutChange);
    mobileLayout.addEventListener('change', onLayoutChange);
    document.addEventListener('visibilitychange', onVisibilityChange);

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(([entry]) => {
        sectionVisible = Boolean(entry?.isIntersecting);
        if (sectionVisible) scheduleEvaluation();
        else stopPlayback();
      });
      observer.observe(story);
    } else {
      sectionVisible = true;
      scheduleEvaluation();
    }
  }

  return () => {
    observer?.disconnect();
    stopPlayback();
    player.destroy();
    unregister();
    window.cancelAnimationFrame(evaluationFrame);
    window.removeEventListener('scroll', scheduleEvaluation);
    window.removeEventListener('resize', onLayoutChange);
    mobileLayout.removeEventListener('change', onLayoutChange);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
};

export const initializeLandingPlayback = ({
  prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches
} = {}) => {
  const authority = createPlaybackAuthority();
  const cleanups = [
    initializeHeroDemo({ authority, prefersReducedMotion }),
    initializeStory({ authority, prefersReducedMotion })
  ];
  return () => cleanups.forEach((cleanup) => cleanup());
};
