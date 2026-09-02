const currentYear = String(new Date().getFullYear());
for (const target of document.querySelectorAll('[data-current-year]')) {
  target.textContent = currentYear;
}

const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

const replayShowcase = document.querySelector('[data-replay-showcase]');
if (replayShowcase instanceof HTMLElement) {
  const poster = replayShowcase.querySelector('[data-replay-poster]');
  const player = replayShowcase.querySelector('[data-replay-player]');
  const toggle = replayShowcase.querySelector('[data-replay-toggle]');
  const toggleIcon = replayShowcase.querySelector('[data-replay-toggle-icon]');
  const toggleLabel = replayShowcase.querySelector('[data-replay-toggle-label]');
  const activePosition = replayShowcase.querySelector(
    '[data-replay-active-position]'
  );
  const activeName = replayShowcase.querySelector('[data-replay-active-name]');
  const activeSummary = replayShowcase.querySelector(
    '[data-replay-active-summary]'
  );
  const selectors = [
    ...replayShowcase.querySelectorAll('[data-replay-select]')
  ].filter((target) => target instanceof HTMLButtonElement);

  if (
    poster instanceof HTMLImageElement &&
    player instanceof HTMLImageElement &&
    toggle instanceof HTMLButtonElement &&
    toggleIcon instanceof HTMLElement &&
    toggleLabel instanceof HTMLElement &&
    activePosition instanceof HTMLElement &&
    activeName instanceof HTMLElement &&
    activeSummary instanceof HTMLElement &&
    selectors.length > 0
  ) {
    let active = selectors.find(
      (selector) => selector.getAttribute('aria-pressed') === 'true'
    ) ?? selectors[0];
    let requestId = 0;
    let sectionVisible = false;
    let userPaused = false;
    let observer = null;

    const activeLabel = () => active.dataset.label ?? 'selected entry';

    const setToggleState = (playing) => {
      toggle.setAttribute('aria-pressed', String(playing));
      toggle.setAttribute(
        'aria-label',
        `${playing ? 'Pause' : 'Play'} ${activeLabel()} build replay`
      );
      toggleIcon.textContent = playing ? 'Ⅱ' : '▶';
      toggleLabel.textContent = playing ? 'Pause replay' : 'Play replay';
    };

    const showPoster = () => {
      requestId += 1;
      player.removeAttribute('src');
      player.hidden = true;
      player.setAttribute('aria-hidden', 'true');
      poster.hidden = false;
      toggle.disabled = false;
      replayShowcase.dataset.replayState = 'poster';
      setToggleState(false);
    };

    const play = () => {
      const source = active.dataset.replaySrc;
      if (!source || document.hidden) return;
      const activeRequest = requestId + 1;
      requestId = activeRequest;
      toggle.disabled = true;
      toggleLabel.textContent = 'Loading…';
      replayShowcase.dataset.replayState = 'loading';
      player.onload = () => {
        if (requestId !== activeRequest) return;
        poster.hidden = true;
        player.hidden = false;
        player.setAttribute('aria-hidden', 'false');
        toggle.disabled = false;
        replayShowcase.dataset.replayState = 'playing';
        setToggleState(true);
      };
      player.onerror = () => {
        if (requestId === activeRequest) showPoster();
      };
      player.alt = active.dataset.alt ?? '';
      player.src = source;
    };

    const select = (selector) => {
      active = selector;
      userPaused = false;
      for (const candidate of selectors) {
        candidate.setAttribute(
          'aria-pressed',
          String(candidate === selector)
        );
      }
      showPoster();
      poster.src = selector.dataset.posterSrc ?? poster.src;
      poster.alt = selector.dataset.alt ?? '';
      activePosition.textContent = selector.dataset.position ?? '';
      activeName.textContent = activeLabel();
      activeSummary.textContent = selector.dataset.summary ?? '';
      setToggleState(false);
      if (!prefersReducedMotion && sectionVisible) play();
    };

    for (const selector of selectors) {
      selector.addEventListener('click', () => select(selector));
    }
    toggle.addEventListener('click', () => {
      if (replayShowcase.dataset.replayState === 'playing') {
        userPaused = true;
        showPoster();
        return;
      }
      userPaused = false;
      play();
    });

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(([entry]) => {
        sectionVisible = Boolean(entry?.isIntersecting);
        if (!sectionVisible || document.hidden) {
          showPoster();
        } else if (
          entry.intersectionRatio >= 0.3 &&
          !prefersReducedMotion &&
          !userPaused
        ) {
          play();
        }
      }, { threshold: [0, 0.3] });
      observer.observe(replayShowcase);
    }

    const onVisibilityChange = () => {
      if (document.hidden) showPoster();
      else if (sectionVisible && !prefersReducedMotion && !userPaused) play();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      showPoster();
    }, { once: true });
  }
}

const revealTargets = [...document.querySelectorAll('[data-reveal]')];
if (
  revealTargets.length > 0 &&
  'IntersectionObserver' in window &&
  !prefersReducedMotion
) {
  document.documentElement.dataset.motion = 'ready';
  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.dataset.revealed = 'true';
        revealObserver.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
  );
  for (const target of revealTargets) revealObserver.observe(target);
} else {
  for (const target of revealTargets) target.dataset.revealed = 'true';
}

const copyText = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const fallback = document.createElement('textarea');
  fallback.value = text;
  fallback.setAttribute('readonly', '');
  fallback.style.position = 'fixed';
  fallback.style.opacity = '0';
  document.body.append(fallback);
  fallback.select();
  const copied = document.execCommand('copy');
  fallback.remove();
  if (!copied) throw new Error('Clipboard unavailable.');
};

const agentInstructionButtons = [
  ...document.querySelectorAll('[data-copy-agent-instruction]')
].filter((button) => button instanceof HTMLButtonElement);
const agentInstructionFeedback = [
  ...document.querySelectorAll('[data-copy-feedback]')
].filter((feedback) => feedback instanceof HTMLElement);
let agentInstructionResetTimer = 0;

const resetAgentInstructionState = () => {
  for (const button of agentInstructionButtons) {
    button.dataset.copied = 'false';
    button.disabled = false;
    const state = button.querySelector('[data-copy-state]');
    if (state instanceof HTMLElement) {
      state.textContent =
        state.dataset.defaultState ?? state.textContent ?? 'Copy';
    }
  }
  for (const feedback of agentInstructionFeedback) {
    delete feedback.dataset.state;
    feedback.textContent = feedback.dataset.defaultFeedback ?? '';
  }
};

const setAgentInstructionState = (status) => {
  for (const button of agentInstructionButtons) {
    button.disabled = status === 'copying';
    button.dataset.copied = String(status === 'success');
    const state = button.querySelector('[data-copy-state]');
    if (!(state instanceof HTMLElement)) continue;
    if (status === 'success') {
      state.textContent = state.dataset.copiedState ?? 'Copied';
    } else if (status === 'copying') {
      state.textContent = 'Copying…';
    } else if (status === 'error') {
      state.textContent = 'Retry';
    }
  }
  for (const feedback of agentInstructionFeedback) {
    feedback.dataset.state = status;
    feedback.textContent = status === 'success'
      ? 'Copied — paste into ChatGPT, Cursor, or Claude.'
      : status === 'copying'
        ? 'Copying…'
        : 'Clipboard unavailable. Try copying again.';
  }
};

for (const button of agentInstructionButtons) {
  button.addEventListener('click', async () => {
    const instruction = button.dataset.instruction?.trim();
    if (!instruction) return;
    window.clearTimeout(agentInstructionResetTimer);
    setAgentInstructionState('copying');
    try {
      await copyText(instruction);
      setAgentInstructionState('success');
    } catch {
      setAgentInstructionState('error');
    } finally {
      for (const instructionButton of agentInstructionButtons) {
        instructionButton.disabled = false;
      }
      agentInstructionResetTimer = window.setTimeout(
        resetAgentInstructionState,
        7_000
      );
    }
  });
}

for (const block of document.querySelectorAll('.doc-article pre')) {
  const code = block.querySelector('code');
  if (!code) continue;
  const button = document.createElement('button');
  button.className = 'copy-code';
  button.type = 'button';
  button.textContent = 'Copy';
  button.setAttribute('aria-label', 'Copy code');
  button.addEventListener('click', async () => {
    await navigator.clipboard.writeText(code.textContent ?? '');
    button.textContent = 'Copied';
    window.setTimeout(() => {
      button.textContent = 'Copy';
    }, 1_200);
  });
  block.append(button);
}

const tocLinks = [...document.querySelectorAll('.page-toc a')];
if (tocLinks.length > 0 && 'IntersectionObserver' in window) {
  const linksById = new Map(
    tocLinks.map((link) => [link.getAttribute('href')?.slice(1), link])
  );
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.find((entry) => entry.isIntersecting);
      if (!visible) return;
      for (const link of tocLinks) link.removeAttribute('aria-current');
      linksById.get(visible.target.id)?.setAttribute('aria-current', 'true');
    },
    { rootMargin: '-15% 0px -70% 0px' }
  );
  for (const id of linksById.keys()) {
    const heading = document.getElementById(id);
    if (heading) observer.observe(heading);
  }
}
