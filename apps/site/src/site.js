const currentYear = String(new Date().getFullYear());
for (const target of document.querySelectorAll('[data-current-year]')) {
  target.textContent = currentYear;
}

const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

const agentDemo = document.querySelector('[data-agent-demo]');
if (agentDemo instanceof HTMLElement) {
  const input = agentDemo.querySelector('[data-demo-input]');
  const reel = agentDemo.querySelector('[data-demo-reel]');
  const sequences = JSON.parse(agentDemo.dataset.sequences ?? '[]');
  let sequenceIndex = 0;
  let timers = [];

  const clearTimers = () => {
    for (const timer of timers) window.clearTimeout(timer);
    timers = [];
  };

  const schedule = (callback, delay) => {
    const timer = window.setTimeout(callback, delay);
    timers.push(timer);
  };

  const setReelSource = (source) => {
    if (!(reel instanceof HTMLImageElement) || !source) return;
    reel.src = source;
  };

  const restartReel = () => {
    if (!(reel instanceof HTMLImageElement)) return;
    const sequence = sequences[sequenceIndex];
    const source = sequence?.reel;
    if (!source) return;
    reel.alt = `ashfox building ${sequence.name} from an empty scene`;
    agentDemo.dataset.demo = sequence.name;
    const separator = source.includes('?') ? '&' : '?';
    reel.src = `${source}${separator}run=${Date.now()}`;
  };

  const typePrompt = () => {
    if (!(input instanceof HTMLTextAreaElement)) return;
    const sequence = sequences[sequenceIndex];
    if (!sequence) return;
    clearTimers();
    agentDemo.dataset.busy = 'false';
    agentDemo.dataset.stage = 'typing';
    agentDemo.dataset.demo = sequence.name;
    setReelSource(reel?.dataset.emptySrc);
    if (reel instanceof HTMLImageElement) {
      reel.alt = `Empty ashfox scene prepared for ${sequence.name}`;
    }
    input.value = '';
    let characterIndex = 0;
    const typeNext = () => {
      input.value = sequence.prompt.slice(0, characterIndex + 1);
      characterIndex += 1;
      if (characterIndex < sequence.prompt.length) {
        schedule(typeNext, 22);
        return;
      }
      schedule(runSequence, 420);
    };
    schedule(typeNext, 450);
  };

  const runSequence = () => {
    clearTimers();
    const sequence = sequences[sequenceIndex];
    if (!sequence) return;
    agentDemo.dataset.busy = 'true';
    agentDemo.dataset.stage = 'playing';
    restartReel();
    schedule(() => {
      agentDemo.dataset.busy = 'false';
      agentDemo.dataset.stage = 'cooldown';
      if (sequences.length < 2) return;
      sequenceIndex = (sequenceIndex + 1) % sequences.length;
      schedule(typePrompt, sequence.cooldownMs);
    }, sequence.playbackMs);
  };

  if (
    input instanceof HTMLTextAreaElement &&
    sequences.length > 0
  ) {
    if (prefersReducedMotion) {
      input.value = sequences[0].prompt;
      setReelSource(sequences[0].poster);
      agentDemo.dataset.demo = sequences[0].name;
      agentDemo.dataset.stage = 'complete';
    } else {
      typePrompt();
    }
  }
}

const story = document.querySelector('[data-scroll-story]');
if (story instanceof HTMLElement) {
  const chapters = [...story.querySelectorAll('[data-story-chapter]')];
  const media = [...story.querySelectorAll('[data-story-media]')];
  const mobileMedia = [...story.querySelectorAll('[data-story-mobile]')];
  const position = story.querySelector('[data-story-position]');
  let activeStoryIndex = -1;

  const restartStoryImage = (image) => {
    if (!(image instanceof HTMLImageElement)) return;
    const source = image.dataset.storySrc;
    if (!source) return;
    const separator = source.includes('?') ? '&' : '?';
    image.src = `${source}${separator}run=${Date.now()}`;
  };

  const setActiveStory = (index) => {
    if (index === activeStoryIndex || !chapters[index]) return;
    activeStoryIndex = index;
    story.style.setProperty(
      '--story-progress',
      String((index + 1) / chapters.length)
    );
    for (const [chapterIndex, chapter] of chapters.entries()) {
      chapter.dataset.active = String(chapterIndex === index);
    }
    for (const [mediaIndex, item] of media.entries()) {
      item.dataset.active = String(mediaIndex === index);
      if (mediaIndex === index) restartStoryImage(item.querySelector('img'));
    }
    restartStoryImage(mobileMedia[index]);
    if (position instanceof HTMLElement) {
      position.textContent =
        `0${index + 1} / 0${chapters.length}`;
    }
  };

  if ('IntersectionObserver' in window && !prefersReducedMotion) {
    const storyObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (!visible) return;
        setActiveStory(chapters.indexOf(visible.target));
      },
      { rootMargin: '-38% 0px -38% 0px' }
    );
    for (const chapter of chapters) storyObserver.observe(chapter);
  } else {
    setActiveStory(0);
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

const setupPromptButtons = [
  ...document.querySelectorAll('[data-copy-setup-prompt]')
].filter((button) => button instanceof HTMLButtonElement);
const setupPromptFeedback = [
  ...document.querySelectorAll('[data-copy-feedback]')
].filter((feedback) => feedback instanceof HTMLElement);
let setupPromptResetTimer = 0;

const resetSetupPromptState = () => {
  for (const button of setupPromptButtons) {
    button.dataset.copied = 'false';
    button.disabled = false;
    const state = button.querySelector('[data-copy-state]');
    if (state instanceof HTMLElement) {
      state.textContent =
        state.dataset.defaultState ?? state.textContent ?? 'Copy';
    }
  }
  for (const feedback of setupPromptFeedback) {
    delete feedback.dataset.state;
    feedback.textContent = feedback.dataset.defaultFeedback ?? '';
  }
};

const setSetupPromptState = (status) => {
  for (const button of setupPromptButtons) {
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
  for (const feedback of setupPromptFeedback) {
    feedback.dataset.state = status;
    feedback.textContent = status === 'success'
      ? 'Copied — paste into ChatGPT, Cursor, or Claude.'
      : status === 'copying'
        ? 'Copying instructions…'
        : 'Clipboard unavailable. Try copying again.';
  }
};

for (const button of setupPromptButtons) {
  button.addEventListener('click', async () => {
    const prompt = button.dataset.prompt?.trim();
    if (!prompt) return;
    window.clearTimeout(setupPromptResetTimer);
    setSetupPromptState('copying');
    try {
      await copyText(prompt);
      setSetupPromptState('success');
    } catch {
      setSetupPromptState('error');
    } finally {
      for (const setupButton of setupPromptButtons) {
        setupButton.disabled = false;
      }
      setupPromptResetTimer = window.setTimeout(
        resetSetupPromptState,
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
