const MEDIA_READY_TIMEOUT_MS = 8_000;

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

const createGifPlayer = ({ authority, owner, root, image }) => {
  let cancelPendingLoad = null;
  let requestId = 0;

  const setState = (state) => {
    root.dataset.mediaState = state;
    image.dataset.mediaState = state;
  };

  const clearSource = () => {
    image.removeAttribute('src');
    delete image.dataset.gifSrc;
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
      image.removeEventListener('load', onLoaded);
      image.removeEventListener('error', onError);
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
    image.addEventListener('load', onLoaded, { once: true });
    image.addEventListener('error', onError, { once: true });
    const separator = source.includes('?') ? '&' : '?';
    image.src = `${source}${separator}ashfox-play=${activeRequest}`;
    image.dataset.gifSrc = source;
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

    setState('ready');
    setState('playing');
    return true;
  };

  setState('poster');
  return {
    destroy() {
      stop();
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
  const playerImage = demo.querySelector('[data-demo-player]');
  const sequences = parseSequences(demo);
  if (
    !(input instanceof HTMLTextAreaElement) ||
    !(poster instanceof HTMLImageElement) ||
    !(viewport instanceof HTMLElement) ||
    !(playerImage instanceof HTMLImageElement) ||
    sequences.length === 0
  ) {
    return () => {};
  }

  const owner = 'hero';
  const player = createGifPlayer({
    authority,
    owner,
    root: demo,
    image: playerImage
  });
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
      const started = await player.play(sequence.gif);
      if (signal.aborted) return;
      if (!started) {
        demo.dataset.busy = 'false';
        demo.dataset.stage = 'error';
        setPoster(sequence.poster, `${sequence.name} completed in ashfox`);
      } else {
        demo.dataset.stage = 'playing';
        if (!(await wait(sequence.durationMs, signal))) return;
        player.stop();
        setPoster(sequence.poster, `${sequence.name} completed in ashfox`);
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

export const initializeLandingPlayback = ({
  prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches
} = {}) => {
  const authority = createPlaybackAuthority();
  const cleanups = [initializeHeroDemo({ authority, prefersReducedMotion })];
  return () => cleanups.forEach((cleanup) => cleanup());
};
