const currentYear = String(new Date().getFullYear());
for (const target of document.querySelectorAll('[data-current-year]')) {
  target.textContent = currentYear;
}

const agentDemo = document.querySelector('[data-agent-demo]');
if (agentDemo instanceof HTMLElement) {
  const input = agentDemo.querySelector('[data-demo-input]');
  const form = agentDemo.querySelector('[data-demo-form]');
  const submit = agentDemo.querySelector('[data-demo-submit]');
  const phaseLabel = agentDemo.querySelector('[data-demo-phase]');
  const detailLabel = agentDemo.querySelector('[data-demo-detail]');
  const commandLabel = agentDemo.querySelector('[data-demo-command]');
  const reel = agentDemo.querySelector('[data-demo-reel]');
  const stepIndicators = [
    ...agentDemo.querySelectorAll('[data-demo-step]')
  ];
  const prompts = JSON.parse(agentDemo.dataset.prompts ?? '[]');
  const phases = JSON.parse(agentDemo.dataset.phases ?? '[]');
  const phaseDelays = JSON.parse(agentDemo.dataset.phaseDelays ?? '[]');
  const duration = Number(agentDemo.dataset.duration ?? 0);
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  let promptIndex = 0;
  let autoplay = !reduceMotion;
  let timers = [];

  const clearTimers = () => {
    for (const timer of timers) window.clearTimeout(timer);
    timers = [];
  };

  const schedule = (callback, delay) => {
    const timer = window.setTimeout(callback, delay);
    timers.push(timer);
  };

  const setPhase = (index) => {
    const phase = phases[index];
    if (!phase) return;
    agentDemo.dataset.phase = String(index);
    if (phaseLabel) phaseLabel.textContent = phase[0];
    if (detailLabel) detailLabel.textContent = phase[1];
    if (commandLabel) {
      commandLabel.textContent = phase[2] ?? 'Canonical batch applied';
    }
    for (const [stepIndex, indicator] of stepIndicators.entries()) {
      indicator.classList.toggle('is-complete', stepIndex <= index);
    }
  };

  const setReelSource = (source) => {
    if (!(reel instanceof HTMLImageElement) || !source) return;
    reel.src = source;
  };

  const restartReel = () => {
    if (!(reel instanceof HTMLImageElement)) return;
    const source = reel.dataset.reelSrc;
    if (!source) return;
    const separator = source.includes('?') ? '&' : '?';
    reel.src = `${source}${separator}run=${Date.now()}`;
  };

  const typePrompt = (prompt) => {
    if (!(input instanceof HTMLTextAreaElement)) return;
    clearTimers();
    input.value = '';
    let characterIndex = 0;
    const typeNext = () => {
      if (!autoplay) return;
      input.value = prompt.slice(0, characterIndex + 1);
      characterIndex += 1;
      if (characterIndex < prompt.length) {
        schedule(typeNext, 22);
        return;
      }
      schedule(runSequence, 420);
    };
    schedule(typeNext, 450);
  };

  const runSequence = () => {
    clearTimers();
    agentDemo.dataset.busy = 'true';
    if (submit instanceof HTMLButtonElement) submit.disabled = true;
    restartReel();
    for (let index = 0; index < phases.length; index += 1) {
      schedule(() => setPhase(index), phaseDelays[index] ?? index * 1_200);
    }
    schedule(() => {
      agentDemo.dataset.busy = 'false';
      if (submit instanceof HTMLButtonElement) submit.disabled = false;
      if (!autoplay || prompts.length < 2) return;
      promptIndex = (promptIndex + 1) % prompts.length;
      schedule(() => typePrompt(prompts[promptIndex]), 1_550);
    }, duration || phases.length * 1_200);
  };

  const stopAutoplay = () => {
    autoplay = false;
    clearTimers();
    agentDemo.dataset.busy = 'false';
    if (submit instanceof HTMLButtonElement) submit.disabled = false;
  };

  if (
    input instanceof HTMLTextAreaElement &&
    form instanceof HTMLFormElement &&
    prompts.length > 0 &&
    phases.length > 0
  ) {
    if (reduceMotion) {
      input.value = prompts[0];
      setReelSource(reel?.dataset.posterSrc);
      setPhase(phases.length - 1);
    } else {
      typePrompt(prompts[0]);
    }
    input.addEventListener('focus', stopAutoplay);
    input.addEventListener('input', () => {
      stopAutoplay();
      setReelSource(reel?.dataset.emptySrc);
      setPhase(0);
      if (phaseLabel) phaseLabel.textContent = 'Ready';
      if (detailLabel) detailLabel.textContent = 'Your prompt stays local';
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      stopAutoplay();
      runSequence();
    });
  }
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
