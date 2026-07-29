const currentYear = String(new Date().getFullYear());
for (const target of document.querySelectorAll('[data-current-year]')) {
  target.textContent = currentYear;
}

const agentDemo = document.querySelector('[data-agent-demo]');
if (agentDemo instanceof HTMLElement) {
  const input = agentDemo.querySelector('[data-demo-input]');
  const reel = agentDemo.querySelector('[data-demo-reel]');
  const sequences = JSON.parse(agentDemo.dataset.sequences ?? '[]');
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
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
    reel.alt = `Ashfox building ${sequence.name} from an empty scene`;
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
      reel.alt = `Empty Ashfox scene prepared for ${sequence.name}`;
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
      setReelSource(sequence.poster);
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
    if (reduceMotion) {
      input.value = sequences[0].prompt;
      setReelSource(sequences[0].poster);
      agentDemo.dataset.demo = sequences[0].name;
      agentDemo.dataset.stage = 'complete';
    } else {
      typePrompt();
    }
  }
}

const quickStartButton = document.querySelector(
  '[data-copy-quick-start]'
);
const quickStartPrompt = document.querySelector(
  '[data-quick-start-prompt]'
);
if (
  quickStartButton instanceof HTMLButtonElement &&
  quickStartPrompt instanceof HTMLElement
) {
  quickStartButton.addEventListener('click', async () => {
    const prompt = quickStartPrompt.textContent?.trim();
    if (!prompt) return;
    quickStartButton.disabled = true;
    try {
      await navigator.clipboard.writeText(prompt);
      quickStartButton.textContent = 'Copied';
    } catch {
      quickStartButton.textContent = 'Copy failed';
    } finally {
      window.setTimeout(() => {
        quickStartButton.disabled = false;
        quickStartButton.textContent = 'Copy prompt';
      }, 1_200);
    }
  });
}

const searchInput = document.querySelector('#docs-search');
if (searchInput instanceof HTMLInputElement) {
  const links = [...document.querySelectorAll('[data-doc-link]')];
  const applyFilter = () => {
    const query = searchInput.value.trim().toLowerCase();
    for (const link of links) {
      link.hidden = query.length > 0 && !link.dataset.search.includes(query);
    }
    for (const section of document.querySelectorAll('.docs-nav section')) {
      section.hidden = !section.querySelector('[data-doc-link]:not([hidden])');
    }
  };
  searchInput.addEventListener('input', applyFilter);
  document.addEventListener('keydown', (event) => {
    if (
      event.key === '/' &&
      !(event.target instanceof HTMLInputElement) &&
      !(event.target instanceof HTMLTextAreaElement)
    ) {
      event.preventDefault();
      searchInput.focus();
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
