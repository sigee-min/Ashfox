const createGifPlayer = ({ cards, player, prefersReducedMotion }) => {
  const canHover = window.matchMedia('(hover: hover)').matches;
  let activeCard = null;
  let generation = 0;

  const setState = (card, state) => {
    for (const item of cards) {
      item.dataset.previewState = item === card ? state : 'poster';
      item.setAttribute('aria-pressed', String(item === card));
    }
  };

  const stop = () => {
    generation += 1;
    player.onload = null;
    player.onerror = null;
    player.removeAttribute('src');
    delete player.dataset.src;
    setState(null, 'poster');
    activeCard = null;
  };

  const play = (card) => {
    if (prefersReducedMotion || card === activeCard) return;
    const host = card.querySelector('[data-gallery-media]');
    const source = card.dataset.gif;
    if (!(host instanceof HTMLElement) || !source) return;

    stop();
    activeCard = card;
    const activeGeneration = generation;
    host.append(player);
    player.dataset.src = source;
    setState(card, 'loading');
    const finish = (ready) => {
      if (generation !== activeGeneration || activeCard !== card) return;
      player.onload = null;
      player.onerror = null;
      if (ready) setState(card, 'playing');
      else stop();
    };
    player.onload = () => finish(true);
    player.onerror = () => finish(false);
    player.src = source;
    if (player.complete && player.naturalWidth > 0) finish(true);
  };

  const onPointerEnter = (event) => {
    if (canHover && event.currentTarget instanceof HTMLElement) {
      play(event.currentTarget);
    }
  };
  const onPointerLeave = (event) => {
    if (canHover && event.currentTarget === activeCard) stop();
  };
  const onFocus = (event) => {
    const card = event.currentTarget;
    if (
      card instanceof HTMLElement &&
      (canHover || card.matches(':focus-visible'))
    ) {
      play(card);
    }
  };
  const onBlur = (event) => {
    if (event.currentTarget === activeCard) stop();
  };
  const onClick = (event) => {
    if (canHover || event.detail === 0) return;
    const card = event.currentTarget;
    if (!(card instanceof HTMLElement)) return;
    if (card === activeCard) stop();
    else play(card);
  };

  let observer = null;
  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting && entry.target === activeCard) stop();
      }
    }, { rootMargin: '-8% 0px', threshold: 0.12 });
    for (const card of cards) observer.observe(card);
  }

  if (prefersReducedMotion) {
    for (const card of cards) card.disabled = true;
  } else {
    for (const card of cards) {
      card.addEventListener('pointerenter', onPointerEnter);
      card.addEventListener('pointerleave', onPointerLeave);
      card.addEventListener('focus', onFocus);
      card.addEventListener('blur', onBlur);
      card.addEventListener('click', onClick);
    }
  }

  const onVisibilityChange = () => {
    if (document.hidden) stop();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  stop();

  return () => {
    observer?.disconnect();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    for (const card of cards) {
      card.removeEventListener('pointerenter', onPointerEnter);
      card.removeEventListener('pointerleave', onPointerLeave);
      card.removeEventListener('focus', onFocus);
      card.removeEventListener('blur', onBlur);
      card.removeEventListener('click', onClick);
    }
    stop();
  };
};

export const initializeGallery = ({
  prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches
} = {}) => {
  const gallery = document.querySelector('[data-gallery]');
  if (!(gallery instanceof HTMLElement)) return () => {};
  const cards = [...gallery.querySelectorAll('[data-gallery-card]')]
    .filter((card) => card instanceof HTMLButtonElement);
  const player = gallery.querySelector('[data-gallery-player]');
  if (!(player instanceof HTMLImageElement) || cards.length === 0) {
    return () => {};
  }
  return createGifPlayer({ cards, player, prefersReducedMotion });
};
