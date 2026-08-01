const normalized = (value) =>
  value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');

const createGifPlayer = ({ cards, player, prefersReducedMotion }) => {
  const canHover = window.matchMedia('(hover: hover)').matches;
  let activeCard = null;
  let generation = 0;

  const setState = (card, state) => {
    for (const item of cards) {
      item.dataset.previewState = item === card ? state : 'poster';
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
    if (canHover && event.currentTarget instanceof HTMLAnchorElement) {
      play(event.currentTarget);
    }
  };
  const onPointerLeave = (event) => {
    if (canHover && event.currentTarget === activeCard) stop();
  };
  const onFocus = (event) => {
    if (event.currentTarget instanceof HTMLAnchorElement) {
      play(event.currentTarget);
    }
  };
  const onBlur = (event) => {
    if (event.currentTarget === activeCard) stop();
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

  if (!prefersReducedMotion) {
    for (const card of cards) {
      card.addEventListener('pointerenter', onPointerEnter);
      card.addEventListener('pointerleave', onPointerLeave);
      card.addEventListener('focus', onFocus);
      card.addEventListener('blur', onBlur);
    }
  }

  const onVisibilityChange = () => {
    if (document.hidden) stop();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  stop();

  return {
    stop,
    cleanup: () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      for (const card of cards) {
        card.removeEventListener('pointerenter', onPointerEnter);
        card.removeEventListener('pointerleave', onPointerLeave);
        card.removeEventListener('focus', onFocus);
        card.removeEventListener('blur', onBlur);
      }
      stop();
    }
  };
};

const createFilters = ({ gallery, items, stopPreview }) => {
  const input = gallery.querySelector('[data-gallery-search-input]');
  const buttons = [...gallery.querySelectorAll('[data-gallery-filter]')]
    .filter((button) => button instanceof HTMLButtonElement);
  const results = gallery.querySelector('[data-gallery-results]');
  const empty = gallery.querySelector('[data-gallery-empty]');
  const reset = gallery.querySelector('[data-gallery-reset]');
  if (
    !(input instanceof HTMLInputElement) ||
    !(results instanceof HTMLElement) ||
    !(empty instanceof HTMLElement) ||
    !(reset instanceof HTMLButtonElement) ||
    buttons.length === 0
  ) {
    return () => {};
  }

  const allowedCategories = new Map(
    buttons.map((button) => [
      normalized(button.dataset.galleryFilter ?? ''),
      button.dataset.galleryFilter ?? 'all'
    ])
  );
  const initial = new URL(window.location.href);
  const requestedCategory = normalized(
    initial.searchParams.get('category') ?? 'all'
  );
  let category = allowedCategories.get(requestedCategory) ?? 'all';
  input.value = initial.searchParams.get('q') ?? '';

  const apply = ({ updateUrl = true } = {}) => {
    const query = normalized(input.value);
    const normalizedCategory = normalized(category);
    let visible = 0;
    for (const item of items) {
      const matchesCategory = normalizedCategory === 'all' ||
        normalized(item.dataset.galleryCategory ?? '') === normalizedCategory;
      const matchesSearch = query.length === 0 ||
        normalized(item.dataset.gallerySearch ?? '').includes(query);
      item.hidden = !(matchesCategory && matchesSearch);
      if (!item.hidden) visible += 1;
    }
    stopPreview();
    for (const button of buttons) {
      button.setAttribute(
        'aria-pressed',
        String(
          normalized(button.dataset.galleryFilter ?? '') === normalizedCategory
        )
      );
    }
    results.textContent = visible === items.length
      ? `${visible} demos`
      : `${visible} of ${items.length} demos`;
    empty.hidden = visible !== 0;

    if (updateUrl) {
      const url = new URL(window.location.href);
      if (query) url.searchParams.set('q', input.value.trim());
      else url.searchParams.delete('q');
      if (normalizedCategory !== 'all') {
        url.searchParams.set('category', category);
      } else {
        url.searchParams.delete('category');
      }
      window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    }
  };

  const onInput = () => apply();
  const onFilter = (event) => {
    const button = event.currentTarget;
    if (!(button instanceof HTMLButtonElement)) return;
    category = button.dataset.galleryFilter ?? 'all';
    apply();
  };
  const onReset = () => {
    category = 'all';
    input.value = '';
    apply();
    input.focus();
  };

  input.addEventListener('input', onInput);
  for (const button of buttons) button.addEventListener('click', onFilter);
  reset.addEventListener('click', onReset);
  apply({ updateUrl: false });

  return () => {
    input.removeEventListener('input', onInput);
    for (const button of buttons) button.removeEventListener('click', onFilter);
    reset.removeEventListener('click', onReset);
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
    .filter((card) => card instanceof HTMLAnchorElement);
  const items = [...gallery.querySelectorAll('[data-gallery-item]')]
    .filter((item) => item instanceof HTMLElement);
  const player = gallery.querySelector('[data-gallery-player]');
  if (
    !(player instanceof HTMLImageElement) ||
    cards.length === 0 ||
    items.length !== cards.length
  ) {
    return () => {};
  }
  const preview = createGifPlayer({ cards, player, prefersReducedMotion });
  const cleanupFilters = createFilters({
    gallery,
    items,
    stopPreview: preview.stop
  });
  return () => {
    cleanupFilters();
    preview.cleanup();
  };
};
