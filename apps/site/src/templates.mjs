import {
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

const studioDemoUrl = (studioUrl, slug) =>
  `${studioUrl}${studioUrl.includes('?') ? '&' : '?'}demo=${encodeURIComponent(slug)}`;

const siteHeader = ({ active, studioUrl }) => `
  <header class="site-header">
    <a class="brand" href="/home/" aria-label="Ashfox home">
      <span class="brand-mark" aria-hidden="true">✦</span>
      <span>ashfox</span>
    </a>
    <nav class="primary-nav" aria-label="Primary navigation">
      <a href="/home/#quick-start">Quick start</a>
      <a href="/home/#showcase">Examples</a>
      <a ${active === 'docs' ? 'aria-current="page"' : ''} href="/docs/">Docs</a>
    </nav>
    <a class="header-cta" href="${escapeHtml(studioUrl)}">Open Ashfox <span aria-hidden="true">↗</span></a>
  </header>
`;

const pageShell = ({
  active,
  assets,
  body,
  config,
  description,
  path,
  title
}) => {
  const pageTitle = title === 'Ashfox'
    ? 'Ashfox — AI-native low-poly workbench'
    : `${title} — Ashfox`;
  const canonical = absoluteUrl(config.siteOrigin, path);
  const socialImage = absoluteUrl(config.siteOrigin, '/og.png');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="theme-color" content="#111417">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Ashfox">
    <meta property="og:title" content="${escapeHtml(pageTitle)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${escapeHtml(socialImage)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(socialImage)}">
    ${config.siteOrigin ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : ''}
    <link rel="stylesheet" href="${assets.css}">
    <script type="module" src="${assets.js}"></script>
    <title>${escapeHtml(pageTitle)}</title>
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    ${siteHeader({ active, studioUrl: config.studioUrl })}
    ${body}
    <footer class="site-footer">
      <a class="brand footer-brand" href="/home/">
        <span class="brand-mark" aria-hidden="true">✦</span>
        <span>ashfox</span>
      </a>
      <p>AI-native low-poly workbench.</p>
      <div class="footer-links">
        <a href="/docs/">Documentation</a>
        <a href="https://github.com/sigee-min/ashfox">GitHub</a>
        <span>© <span data-current-year></span> Ashfox</span>
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
  >
    <div class="studio-capture">
      <img
        src="${escapeHtml(demo.sequences[0].poster)}"
        data-demo-reel
        data-empty-src="/media/showcase/empty-workspace.jpg"
        width="1280"
        height="720"
        alt="${escapeHtml(`Ashfox building ${demo.sequences[0].name} from an empty scene`)}"
        decoding="async"
        fetchpriority="high"
      >
      <span class="capture-live"><i></i> Live viewport</span>
      <div class="capture-scan" aria-hidden="true"></div>
    </div>
    <div class="ai-ide-dock">
      <div class="ai-ide-work-status" aria-live="polite">
        <span>Working…</span>
        <i aria-hidden="true">›</i>
      </div>
      <div class="ai-ide-composer" aria-label="Automated prompt preview">
        <button class="ai-ide-add" type="button" tabindex="-1" disabled aria-label="Add context">＋</button>
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
        <span class="ai-ide-model">AI IDE <b>Agent mode</b> <i>⌄</i></span>
        <span class="ai-ide-mic" aria-hidden="true"></span>
        <button class="ai-ide-send" type="button" tabindex="-1" disabled aria-label="Prompt runs automatically">
          <b aria-hidden="true">↑</b>
        </button>
      </div>
    </div>
  </div>
`;

export const renderLandingPage = ({ assets, config }) => {
  const content = landingContent;
  const body = `
    <main id="main">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow"><span></span>${content.eyebrow}</p>
          <h1>${content.title}</h1>
          <p class="hero-summary">${content.summary}</p>
          <div class="hero-actions">
            <a class="button button-primary" href="#quick-start">Quick start <span>↓</span></a>
            <a class="button button-secondary" href="/docs/guides/ai-ide-quick-start/">Read the guide <span>→</span></a>
          </div>
          <ul class="proof-list">
            ${content.proof.map((item) => `<li><span>✓</span>${item}</li>`).join('')}
          </ul>
        </div>
        <div class="hero-visual">${landingDemo(content.demo)}</div>
      </section>

      <section class="quick-start-section" id="quick-start">
        <div class="quick-start-copy">
          <p class="eyebrow"><span></span>Quick start</p>
          <h2>${escapeHtml(content.quickStart.title)}</h2>
          <p>${escapeHtml(content.quickStart.body)}</p>
          <a href="https://ashfox.io">https://ashfox.io <span>↗</span></a>
        </div>
        <div class="quick-start-prompt">
          <div>
            <span>Prompt for your AI IDE</span>
            <button type="button" data-copy-quick-start>Copy prompt</button>
          </div>
          <p data-quick-start-prompt>${escapeHtml(content.quickStart.prompt)}</p>
        </div>
      </section>

      <section class="section showcase-section" id="showcase">
        <div class="section-heading split-heading">
          <div>
            <p class="eyebrow"><span></span>Working projects</p>
            <h2>One consistent asset pipeline.</h2>
          </div>
          <p>Modeling, texture density, and motion stay coherent across every asset.</p>
        </div>
        <div class="showcase-grid">
          ${content.showcase.map((item) => `
            <a class="showcase-card" href="${escapeHtml(studioDemoUrl(config.studioUrl, item.studioSlug))}">
              <picture>
                <source srcset="${escapeHtml(item.animation)}" type="image/gif">
                <img
                  src="${escapeHtml(item.image)}"
                  width="1280"
                  height="720"
                  alt="${escapeHtml(`${item.name} animated in Ashfox`)}"
                  loading="lazy"
                >
              </picture>
              <span>${escapeHtml(item.kind)}</span>
              <strong>${escapeHtml(item.name)}</strong>
              <small>${escapeHtml(item.detail)}</small>
            </a>
          `).join('')}
        </div>
      </section>

      <section class="section guide-section" id="guides">
        <div class="section-heading split-heading">
          <div>
            <p class="eyebrow"><span></span>Technical guides</p>
            <h2>Build with your AI IDE.</h2>
          </div>
          <p>Quick start, visual review, and deterministic file delivery.</p>
        </div>
        <div class="guide-grid">
          ${content.guides.map((guide) => `
            <a class="guide-card" href="${escapeHtml(guide.href)}">
              <span>${escapeHtml(guide.index)} · ${escapeHtml(guide.label)}</span>
              <strong>${escapeHtml(guide.title)}</strong>
              <p>${escapeHtml(guide.body)}</p>
              <b aria-hidden="true">Read guide →</b>
            </a>
          `).join('')}
        </div>
      </section>

      <section class="section output-section" id="outputs">
        <div class="output-copy">
          <p class="eyebrow"><span></span>Export</p>
          <h2>Target formats</h2>
          <p>Validation runs before Ashfox prepares the file.</p>
          <a class="text-link" href="/docs/guides/save-and-export/">Save and export guide <span>→</span></a>
        </div>
        <div class="format-grid">
          ${content.formats.map(([name, description], index) => `
            <a class="format-card" href="/docs/architecture/export-targets/">
              <span>0${index + 1}</span>
              <div><strong>${name}</strong><p>${description}</p></div>
              <b aria-hidden="true">↗</b>
            </a>
          `).join('')}
        </div>
      </section>

      <section class="source-banner" id="open-source">
        <div>
          <p class="eyebrow"><span></span>MIT licensed</p>
          <h2>Browser-local and open source.</h2>
          <p>No account, database, or private application server.</p>
        </div>
        <a class="button button-secondary" href="https://github.com/sigee-min/ashfox">GitHub <span>↗</span></a>
      </section>
    </main>
  `;
  return pageShell({
    active: 'product',
    assets,
    body,
    config,
    description: content.summary,
    path: '/home/',
    title: 'Ashfox'
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
            data-doc-link
            data-search="${escapeHtml(`${document.title} ${document.relativePath}`.toLowerCase())}"
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
          <span>Documentation</span>
          <b>Read the system</b>
        </a>
        <label class="docs-search">
          <span class="sr-only">Filter documentation</span>
          <i aria-hidden="true">⌕</i>
          <input id="docs-search" type="search" placeholder="Filter docs" autocomplete="off">
          <kbd>/</kbd>
        </label>
        ${navigation}
      </aside>
      <details class="docs-mobile-nav">
        <summary>Browse documentation <span>⌄</span></summary>
        <div>${navigation}</div>
      </details>
      <article class="doc-article" data-doc-article>
        <div class="doc-breadcrumb">
          <a href="/docs/">Docs</a><span>/</span><span>${escapeHtml(sectionLabels[document.section] ?? document.section)}</span>
        </div>
        ${document.html}
        <div class="doc-end">
          <span>End of document</span>
          <a href="https://github.com/sigee-min/ashfox/blob/main/docs/${escapeHtml(document.relativePath)}">View source ↗</a>
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
    title: document.title
  });
};

export const renderNotFoundPage = ({ assets, config }) =>
  pageShell({
    active: '',
    assets,
    config,
    description: 'The requested Ashfox page could not be found.',
    path: '/404.html',
    title: 'Page not found',
    body: `
      <main id="main" class="not-found">
        <p class="eyebrow"><span></span>404</p>
        <h1>That page left the viewport.</h1>
        <p>Return to the product or continue through the documentation.</p>
        <div class="hero-actions">
          <a class="button button-primary" href="/home/">Go home <span>→</span></a>
          <a class="button button-secondary" href="/docs/">Open docs <span>→</span></a>
        </div>
      </main>
    `
  });
