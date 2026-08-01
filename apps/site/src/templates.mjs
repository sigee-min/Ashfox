import {
  galleryContent,
  landingContent,
  sectionLabels,
  sectionOrder
} from './content.mjs';

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const absoluteUrl = (origin, pathname) =>
  origin ? new URL(pathname, origin).toString() : pathname;

const structuredDataScript = (value) =>
  value
    ? `<script type="application/ld+json">${JSON.stringify(value).replaceAll('<', '\\u003c')}</script>`
    : '';

const githubUrl = 'https://github.com/sigee-min/ashfox';
const contributeUrl = `${githubUrl}/blob/main/CONTRIBUTING.md`;

const brandMark = `
  <span class="brand-mark" aria-hidden="true">
    <img src="/brand/ashfox-mark.svg" alt="" width="30" height="30">
  </span>
`;

const githubMark = `
  <img src="/icons/github.svg" alt="" width="20" height="20">
`;

const githubIconButton = (className = '') => `
  <a
    class="icon-button ${className}"
    href="${githubUrl}"
    aria-label="ashfox on GitHub"
  >${githubMark}</a>
`;

const headerSetupButton = () => `
  <button
    class="header-setup"
    type="button"
    data-copy-agent-instruction
    data-instruction="${escapeHtml(landingContent.quickStart.instruction)}"
    aria-label="Copy the ashfox manifest instruction"
  >
    <span class="header-copy-glyph" aria-hidden="true"></span>
    <span
      data-copy-state
      data-default-state="Copy for agent"
      data-copied-state="Copied"
    >Copy for agent</span>
  </button>
`;

const siteHeader = ({ active }) => `
  <header class="site-header">
    <a class="brand" href="/" aria-label="ashfox home">
      ${brandMark}
      <span>ashfox</span>
    </a>
    <nav class="primary-nav" aria-label="Primary navigation">
      <a href="/#quick-start">Get started</a>
      <a ${active === 'gallery' ? 'aria-current="page"' : ''} href="/gallery/">Gallery</a>
      <a ${active === 'docs' ? 'aria-current="page"' : ''} href="/docs/">Docs</a>
    </nav>
    <div class="header-actions">
      ${headerSetupButton()}
    </div>
  </header>
`;

const pageShell = ({
  active,
  assets,
  body,
  config,
  description,
  headLinks = '',
  path,
  robots = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
  structuredData,
  title
}) => {
  const pageTitle = title === 'ashfox'
    ? 'ashfox — AI-native low-poly workbench'
    : `${title} — ashfox`;
  const canonical = absoluteUrl(config.siteOrigin, path);
  const socialImage = absoluteUrl(config.siteOrigin, '/og.png');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="theme-color" content="#111417">
    <meta name="robots" content="${escapeHtml(robots)}">
    <meta property="og:type" content="website">
    <meta property="og:locale" content="en_US">
    <meta property="og:site_name" content="ashfox">
    <meta property="og:title" content="${escapeHtml(pageTitle)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    <meta property="og:image" content="${escapeHtml(socialImage)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="ashfox — Build. Watch. Export.">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(socialImage)}">
    <meta name="twitter:image:alt" content="ashfox — Build. Watch. Export.">
    ${config.siteOrigin ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : ''}
    ${headLinks}
    <link rel="icon" href="/brand/ashfox-mark.svg" type="image/svg+xml">
    <link rel="stylesheet" href="${assets.css}">
    <script type="module" src="${assets.js}"></script>
    ${structuredDataScript(structuredData)}
    <title>${escapeHtml(pageTitle)}</title>
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    ${siteHeader({ active })}
    ${body}
    <footer class="site-footer">
      <a class="brand footer-brand" href="/">
        ${brandMark}
        <span>ashfox</span>
      </a>
      <p>AI-native low-poly workbench.</p>
      <div class="footer-links">
        <a href="/gallery/">Gallery</a>
        <a href="/docs/">Documentation</a>
        <a href="${githubUrl}">GitHub</a>
        <span>© <span data-current-year></span> ashfox</span>
      </div>
    </footer>
  </body>
</html>`;
};

const landingDemo = (demo) => `
  <div
    class="agent-demo"
    id="demo"
    data-agent-demo
    data-sequences="${escapeHtml(JSON.stringify(demo.sequences))}"
    data-empty-src="/media/empty-workspace.jpg"
  >
    <div
      class="studio-capture"
      data-demo-viewport
      role="img"
      aria-label="${escapeHtml(`${demo.sequences[0].name} completed in ashfox`)}"
    >
      <img
        class="studio-poster"
        src="${escapeHtml(demo.sequences[0].poster)}"
        data-demo-poster
        width="1280"
        height="720"
        alt=""
        aria-hidden="true"
        decoding="async"
        fetchpriority="high"
      >
      <img
        class="studio-playback"
        data-demo-player
        data-media-state="poster"
        width="640"
        height="360"
        alt=""
        decoding="async"
        aria-hidden="true"
      >
      <span class="capture-live"><i></i> Live viewport</span>
    </div>
    <div class="agent-dock">
      <div class="agent-work-status" aria-live="polite">
        <span>Working…</span>
        <i aria-hidden="true">›</i>
      </div>
      <div class="agent-composer" aria-label="Automated prompt preview">
        <button class="agent-add" type="button" tabindex="-1" disabled aria-label="Add context">＋</button>
        <label class="sr-only" for="demo-prompt">Ask anything</label>
        <textarea
          id="demo-prompt"
          data-demo-input
          rows="2"
          readonly
          tabindex="-1"
          aria-readonly="true"
          spellcheck="false"
          placeholder="Ask anything"
        >${escapeHtml(demo.sequences[0].prompt)}</textarea>
        <span class="agent-model"><b>${escapeHtml(demo.sequences[0].model)}</b><em>${escapeHtml(demo.sequences[0].reasoning)}</em><i>⌄</i></span>
        <span class="agent-mic" aria-hidden="true"></span>
        <button class="agent-send" type="button" tabindex="-1" disabled aria-label="Prompt runs automatically">
          <b aria-hidden="true">↑</b>
        </button>
      </div>
    </div>
  </div>
`;

const landingQuickStart = (quickStart) => `
  <section class="quick-start-section" id="quick-start" data-reveal>
    <div class="quick-start-copy">
      <p class="eyebrow"><span></span>Three steps</p>
      <h2>${escapeHtml(quickStart.title)}</h2>
      <p>${escapeHtml(quickStart.body)}</p>
    </div>
    <div class="quick-start-control">
      <ol class="quick-start-steps" aria-label="Start ashfox in three steps">
        <li>
          <b>1</b>
          <span><strong>Copy one instruction</strong><small>It points to the complete manifest</small></span>
        </li>
        <li>
          <b>2</b>
          <span><strong>Paste into your agent</strong><small>ChatGPT, Cursor, or Claude</small></span>
        </li>
        <li>
          <b>3</b>
          <span><strong>Describe the asset</strong><small>Your agent handles the workspace</small></span>
        </li>
      </ol>
      <button
        class="quick-start-action"
        type="button"
        data-copy-agent-instruction
        data-instruction="${escapeHtml(quickStart.instruction)}"
      >
        <span class="copy-glyph" aria-hidden="true"></span>
        <span>
          <strong>Copy the manifest instruction</strong>
          <small>Paste once. Then describe what you want to create.</small>
          <span class="agent-destinations" aria-hidden="true">
            <span class="agent-destinations-label">Paste into</span>
            <span class="agent-destination">
              <img src="/icons/chatgpt.svg" alt="" width="14" height="14">
              ChatGPT
            </span>
            <span class="agent-destination">
              <img src="/icons/cursor.svg" alt="" width="14" height="14">
              Cursor
            </span>
            <span class="agent-destination">
              <img src="/icons/claude.svg" alt="" width="14" height="14">
              Claude
            </span>
          </span>
        </span>
        <b
          data-copy-state
          data-default-state="Copy"
          data-copied-state="Copied"
        >Copy</b>
      </button>
      <p
        data-copy-feedback
        data-default-feedback="Paste into ChatGPT, Cursor, or Claude, then press Enter."
        aria-live="polite"
      >Paste into ChatGPT, Cursor, or Claude, then press Enter.</p>
      <details class="setup-disclosure">
        <summary>See the one line being copied</summary>
        <pre><code>${escapeHtml(quickStart.instruction)}</code></pre>
      </details>
    </div>
  </section>
`;

export const renderLandingPage = ({ assets, config }) => {
  const content = landingContent;
  const body = `
    <main id="main">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow"><span></span>${content.eyebrow}</p>
          <h1>${content.titleLines
            .map((line) => `<span>${escapeHtml(line)}</span>`)
            .join('')}</h1>
          <p class="hero-summary">${content.summary}</p>
          <div class="hero-actions">
            <button
              class="button button-primary hero-copy-action"
              type="button"
              data-copy-agent-instruction
              data-instruction="${escapeHtml(content.quickStart.instruction)}"
            >
              <span
                data-copy-state
                data-default-state="Copy for your AI agent"
                data-copied-state="Copied — paste into your agent"
              >Copy for your AI agent</span>
              <span aria-hidden="true">↗</span>
            </button>
            <a class="button button-secondary" href="#quick-start">See how it works <span>↓</span></a>
            ${githubIconButton('hero-github')}
          </div>
          <p
            class="hero-agent-hint"
            data-copy-feedback
            data-default-feedback="Paste into ChatGPT, Cursor, or Claude. Your agent will ask what you want to create."
            aria-live="polite"
          >Paste into ChatGPT, Cursor, or Claude. Your agent will ask what you want to create.</p>
        </div>
        <div class="hero-visual">${landingDemo(content.demo)}</div>
      </section>

      <section class="section output-section" id="outputs">
        <div class="output-copy" data-reveal>
          <p class="eyebrow"><span></span>Export</p>
          <h2>Editable source. Runtime-ready output.</h2>
          <p>Keep the complete .ashfox project, while target compilers remove hidden work, reduce animation data, and batch GLB geometry without changing the visible asset.</p>
          <a class="text-link" href="/gallery/">Open editable demos <span>→</span></a>
        </div>
        <div class="format-grid">
          ${content.formats.map(([name, description], index) => `
            <a class="format-card" href="/docs/guides/choose-a-format/" data-reveal>
              <span>0${index + 1}</span>
              <div><strong>${name}</strong><p>${description}</p></div>
              <b aria-hidden="true">↗</b>
            </a>
          `).join('')}
        </div>
      </section>

      ${landingQuickStart(content.quickStart)}

      <section class="section guide-section" id="guides">
        <div class="section-heading split-heading" data-reveal>
          <div>
            <p class="eyebrow"><span></span>Guides</p>
            <h2>Everything you need to ship.</h2>
          </div>
          <p>Connect your agent, refine the result, and export when it is ready.</p>
        </div>
        <div class="guide-grid">
          ${content.guides.map((guide) => `
            <a class="guide-card" href="${escapeHtml(guide.href)}" data-reveal>
              <span class="guide-meta">
                <b>${escapeHtml(guide.index)}</b>
                ${escapeHtml(guide.label)}
              </span>
              <span class="guide-copy">
                <strong>${escapeHtml(guide.title)}</strong>
                <p>${escapeHtml(guide.body)}</p>
              </span>
              <span class="guide-link">
                Read guide
                <b aria-hidden="true">→</b>
              </span>
            </a>
          `).join('')}
        </div>
      </section>

      <section class="source-banner" id="open-source" data-reveal>
        <div>
          <p class="eyebrow"><span></span>MIT licensed</p>
          <h2>Free to use. Better with you.</h2>
          <p>If ashfox fits your workflow, star the project or help shape what comes next.</p>
        </div>
        <div class="source-actions">
          <a class="button button-primary" href="${githubUrl}">
            ${githubMark}
            Star on GitHub
          </a>
          <a class="button button-secondary" href="${contributeUrl}">
            Contribute
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>
    </main>
  `;
  return pageShell({
    active: 'product',
    assets,
    body,
    config,
    description: content.summary,
    path: '/',
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          name: 'ashfox',
          url: absoluteUrl(config.siteOrigin, '/'),
          description: content.summary
        },
        {
          '@type': 'SoftwareApplication',
          name: 'ashfox',
          url: absoluteUrl(config.siteOrigin, config.workbenchUrl),
          applicationCategory: 'GraphicsApplication',
          operatingSystem: 'Any',
          description: content.summary,
          image: absoluteUrl(config.siteOrigin, '/og.png'),
          isAccessibleForFree: true,
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD'
          },
          license: `${githubUrl}/blob/main/LICENSE`,
          featureList: [
            'Low-poly modeling',
            'Deterministic texturing',
            'Rigging and animation',
            'Bedrock, GeckoLib, glTF, and GLB export'
          ]
        }
      ]
    },
    title: 'ashfox'
  });
};

const galleryCard = (item, index) => `
  <article
    class="gallery-card"
    data-gallery-item
    data-gallery-id="${escapeHtml(item.galleryId)}"
    data-gallery-category="${escapeHtml(item.category)}"
    data-gallery-search="${escapeHtml(item.searchText)}"
  >
    <a
      class="gallery-preview"
      href="${escapeHtml(item.workbench)}"
      data-gallery-card
      data-gif="${escapeHtml(item.gif)}"
      data-preview-state="poster"
      aria-label="Open ${escapeHtml(item.name)} in the ashfox workbench"
    >
      <span
        class="gallery-media"
        data-gallery-media
        role="img"
        aria-label="${escapeHtml(item.name)}"
      >
        <img
          class="gallery-poster"
          src="${escapeHtml(item.poster)}"
          width="1280"
          height="720"
          alt=""
          aria-hidden="true"
          loading="${index === 0 ? 'eager' : 'lazy'}"
          decoding="async"
        >
        ${index === 0 ? `
          <img
            class="gallery-animation"
            data-gallery-player
            width="640"
            height="360"
            alt=""
            aria-hidden="true"
            decoding="async"
          >
        ` : ''}
        <span class="gallery-preview-state" aria-hidden="true">
          <i></i><b>Open project</b>
        </span>
      </span>
      <div class="gallery-card-copy">
        <h2>${escapeHtml(item.name)}</h2>
        <div class="gallery-model">
          <b>Model</b><span>${escapeHtml(item.agent.model)}</span>
        </div>
        <div class="gallery-tags" aria-label="Tags">
          ${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}
        </div>
      </div>
    </a>
  </article>
`;

export const renderGalleryPage = ({ assets, config }) => {
  const content = galleryContent;
  const path = '/gallery/';
  const body = `
    <main class="gallery" id="main" data-gallery>
      <header class="gallery-hero">
        <p class="eyebrow"><span></span>${escapeHtml(content.eyebrow)}</p>
        <h1>${escapeHtml(content.title)}</h1>
      </header>
      <section class="gallery-controls" aria-label="Filter gallery demos">
        <label class="gallery-search">
          <span class="sr-only">Search demos by name</span>
          <span class="gallery-search-icon" aria-hidden="true"></span>
          <input
            type="search"
            placeholder="Search demos by name"
            autocomplete="off"
            data-gallery-search-input
          >
        </label>
        <div class="gallery-filters" aria-label="Asset categories">
          <button type="button" data-gallery-filter="all" aria-pressed="true">All</button>
          ${content.categories.map((category) => `
            <button
              type="button"
              data-gallery-filter="${escapeHtml(category)}"
              aria-pressed="false"
            >${escapeHtml(category)}</button>
          `).join('')}
        </div>
        <p class="gallery-results" data-gallery-results aria-live="polite">
          ${content.items.length} demos
        </p>
      </section>
      <section
        class="gallery-grid"
        aria-label="ashfox showcase assets"
      >
        ${content.items.map(galleryCard).join('')}
      </section>
      <section class="gallery-empty" data-gallery-empty hidden>
        <p>No demos match this search.</p>
        <button type="button" data-gallery-reset>Clear filters</button>
      </section>
    </main>
  `;

  return pageShell({
    active: 'gallery',
    assets,
    body,
    config,
    description: content.summary,
    path,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'ashfox gallery',
      url: absoluteUrl(config.siteOrigin, path),
      description: content.summary,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: content.items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          item: {
            '@type': 'CreativeWork',
            name: item.name,
            image: absoluteUrl(config.siteOrigin, item.poster),
            url: absoluteUrl(config.siteOrigin, item.workbench)
          }
        }))
      }
    },
    title: 'Gallery'
  });
};

const groupDocuments = (documents) =>
  sectionOrder
    .map((section) => ({
      section,
      label: sectionLabels[section] ?? section,
      documents: documents.filter((document) => document.section === section)
    }))
    .filter((group) => group.documents.length > 0);

const docsNavigation = (documents, currentRoute) => `
  <nav class="docs-nav" aria-label="Documentation">
    ${groupDocuments(documents).map((group) => `
      <section>
        <h2>${escapeHtml(group.label)}</h2>
        ${group.documents.map((document) => `
          <a
            ${document.route === currentRoute ? 'aria-current="page"' : ''}
            href="${document.route}"
          >${escapeHtml(document.title)}</a>
        `).join('')}
      </section>
    `).join('')}
  </nav>
`;

export const renderDocumentationPage = ({
  assets,
  config,
  document,
  documents
}) => {
  const navigation = docsNavigation(documents, document.route);
  const toc = document.toc.length > 0
    ? `<nav class="page-toc" aria-label="On this page">
        <p>On this page</p>
        ${document.toc.map((item) => `
          <a class="toc-level-${item.level}" href="#${item.id}">${escapeHtml(item.text)}</a>
        `).join('')}
      </nav>`
    : '';
  const body = `
    <main id="main" class="docs-shell">
      <aside class="docs-sidebar">
        <a class="docs-home" href="/docs/">
          <span>ashfox Docs</span>
          <b>Build your first asset</b>
        </a>
        ${navigation}
      </aside>
      <details class="docs-mobile-nav">
        <summary>Browse guides <span>⌄</span></summary>
        <div>${navigation}</div>
      </details>
      <article class="doc-article" data-doc-article>
        <div class="doc-breadcrumb">
          <a href="/docs/">Docs</a><span>/</span><span>${escapeHtml(sectionLabels[document.section] ?? document.section)}</span>
        </div>
        ${document.html}
        <div class="doc-end">
          <span>Ready to make something?</span>
          <a href="/#quick-start">Get agent instructions →</a>
        </div>
      </article>
      ${toc}
    </main>
  `;
  return pageShell({
    active: 'docs',
    assets,
    body,
    config,
    description: document.description,
    path: document.route,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: document.title,
      description: document.description,
      url: absoluteUrl(config.siteOrigin, document.route),
      isPartOf: {
        '@type': 'WebSite',
        name: 'ashfox Docs',
        url: absoluteUrl(config.siteOrigin, '/docs/')
      },
      publisher: {
        '@type': 'Organization',
        name: 'ashfox',
        url: absoluteUrl(config.siteOrigin, '/')
      }
    },
    title: document.title
  });
};

export const renderNotFoundPage = ({ assets, config }) =>
  pageShell({
    active: '',
    assets,
    config,
    description: 'The requested ashfox page could not be found.',
    path: '/404.html',
    robots: 'noindex,follow',
    title: 'Page not found',
    body: `
      <main id="main" class="not-found">
        <p class="eyebrow"><span></span>404</p>
        <h1>That page left the viewport.</h1>
        <p>Return to the product or continue through the documentation.</p>
        <div class="hero-actions">
          <a class="button button-primary" href="/">Go home <span>→</span></a>
          <a class="button button-secondary" href="/docs/">Open docs <span>→</span></a>
        </div>
      </main>
    `
  });
