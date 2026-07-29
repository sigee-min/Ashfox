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

const siteHeader = ({ active, studioUrl }) => `
  <header class="site-header">
    <a class="brand" href="/" aria-label="Ashfox home">
      <span class="brand-mark" aria-hidden="true">✦</span>
      <span>ashfox</span>
    </a>
    <nav class="primary-nav" aria-label="Primary navigation">
      <a href="/#demo">Demo</a>
      <a href="/#open-source">Open source</a>
      <a ${active === 'docs' ? 'aria-current="page"' : ''} href="/docs/">Docs</a>
    </nav>
    <a class="header-cta" href="${escapeHtml(studioUrl)}">Open Studio <span aria-hidden="true">↗</span></a>
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
    ? 'Ashfox — AI-native 3D asset authoring'
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
      <a class="brand footer-brand" href="/">
        <span class="brand-mark" aria-hidden="true">✦</span>
        <span>ashfox</span>
      </a>
      <p>Free, open-source 3D asset authoring for AI IDE workflows.</p>
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
    data-prompts="${escapeHtml(JSON.stringify(demo.prompts))}"
    data-phases="${escapeHtml(JSON.stringify(demo.phases))}"
    data-phase-delays="${escapeHtml(JSON.stringify(demo.phaseDelays))}"
    data-duration="${demo.duration}"
  >
    <div class="studio-capture">
      <img
        src="/media/ai-ide-build/00-empty.png"
        data-demo-reel
        data-reel-src="/media/ai-ide-build/auric-fox-build.gif"
        data-poster-src="/media/ai-ide-build/05-animated.png"
        data-empty-src="/media/ai-ide-build/00-empty.png"
        width="1280"
        height="720"
        alt="A real Ashfox session building the Auric Fox from an empty scene"
        decoding="async"
        fetchpriority="high"
      >
      <span class="capture-live"><i></i> Live viewport</span>
      <div class="capture-scan" aria-hidden="true"></div>
      <div class="activity-receipt" aria-live="polite">
        <i aria-hidden="true">✓</i>
        <span>
          <strong data-demo-phase>Ready</strong>
          <small data-demo-detail>Empty local scene</small>
        </span>
      </div>
    </div>
    <div class="ai-ide-window">
      <div class="ai-ide-bar">
        <span><i aria-hidden="true">✦</i> AI IDE workspace</span>
        <small>Working in ashfox</small>
      </div>
      <div class="ai-ide-body">
        <p class="ai-ide-kicker">${escapeHtml(demo.label)}</p>
        <form class="prompt-composer" data-demo-form>
          <label class="sr-only" for="demo-prompt">Describe an asset</label>
          <textarea
            id="demo-prompt"
            data-demo-input
            rows="3"
            spellcheck="false"
          >${escapeHtml(demo.prompts[0])}</textarea>
          <div>
            <span><i></i> Local workspace</span>
            <button type="submit" data-demo-submit>
              Build <b aria-hidden="true">↑</b>
            </button>
          </div>
        </form>
        <div
          class="demo-progress"
          style="--demo-steps: ${demo.phases.length}"
          aria-hidden="true"
        >
          ${demo.phases.map((phase, index) => `
            <i data-demo-step="${index}"></i>
          `).join('')}
        </div>
        <p class="ai-ide-note">
          <span data-demo-command>Batch received</span>
          <span>Undo available</span>
        </p>
      </div>
    </div>
    <p class="demo-caption">
      <span>Real Ashfox workspace</span>
      Submit the prompt to replay the actual build from an empty scene.
    </p>
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
            <a class="button button-primary" href="${escapeHtml(config.studioUrl)}">Open Studio — free <span>↗</span></a>
            <a class="button button-secondary" href="https://github.com/sigee-min/ashfox">View source <span>↗</span></a>
          </div>
          <ul class="proof-list">
            ${content.proof.map((item) => `<li><span>✓</span>${item}</li>`).join('')}
          </ul>
        </div>
        <div class="hero-visual">${landingDemo(content.demo)}</div>
      </section>

      <section class="format-rail freedom-rail" aria-label="Open-source project facts">
        <span>Built in the open</span>
        <strong>MIT licensed</strong>
        <strong>Zero accounts</strong>
        <strong>Zero servers</strong>
        <strong>Zero paywalls</strong>
      </section>

      <section class="section workflow" id="workflow">
        <div class="section-heading">
          <p class="eyebrow"><span></span>The shortest path to a finished asset</p>
          <h2>Intent in. Validated artifact out.</h2>
          <p>No setup maze between the idea and the viewport.</p>
        </div>
        <div class="workflow-grid">
          ${content.workflow.map((item) => `
            <article class="workflow-card">
              <span class="step">${item.step}</span>
              <h3>${item.title}</h3>
              <p>${item.body}</p>
            </article>
          `).join('')}
        </div>
      </section>

      <section class="open-source-section" id="open-source">
        <div class="open-source-mark" aria-hidden="true">OPEN<br>SOURCE</div>
        <div class="open-source-copy">
          <p class="eyebrow"><span></span>${content.openSource.label}</p>
          <h2>${content.openSource.title}</h2>
          <p>${content.openSource.body}</p>
          <a class="button button-primary" href="https://github.com/sigee-min/ashfox">
            Explore on GitHub <span>↗</span>
          </a>
        </div>
        <div class="source-facts">
          ${content.openSource.facts.map(([value, label]) => `
            <div><strong>${value}</strong><span>${label}</span></div>
          `).join('')}
        </div>
      </section>

      <section class="section product-section" id="product">
        <div class="section-heading split-heading">
          <div>
            <p class="eyebrow"><span></span>Built around the work</p>
            <h2>Less interface.<br>More visible progress.</h2>
          </div>
          <p>Ashfox keeps the viewport permanent and reveals exact controls only when they help you inspect or correct the result.</p>
        </div>
        <div class="principle-grid">
          ${content.principles.map((item, index) => `
            <article class="principle-card">
              <div class="principle-number">0${index + 1}</div>
              <p class="card-label">${item.label}</p>
              <h3>${item.title}</h3>
              <p>${item.body}</p>
            </article>
          `).join('')}
        </div>
      </section>

      <section class="section output-section" id="outputs">
        <div class="output-copy">
          <p class="eyebrow"><span></span>Target-aware from the start</p>
          <h2>One project.<br>Four clean exits.</h2>
          <p>Geometry, animation, textures, and target constraints stay together until the final file is written.</p>
          <a class="text-link" href="/docs/architecture/export-targets/">Explore export architecture <span>→</span></a>
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

      <section class="closing-cta">
        <p class="eyebrow"><span></span>Free. Local. Open source.</p>
        <h2>Ask for the asset.<br>Leave with the file.</h2>
        <div class="hero-actions">
          <a class="button button-primary" href="${escapeHtml(config.studioUrl)}">Open Ashfox — free <span>↗</span></a>
          <a class="button button-secondary" href="/docs/">Read the docs <span>→</span></a>
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
          <a class="button button-primary" href="/">Go home <span>→</span></a>
          <a class="button button-secondary" href="/docs/">Open docs <span>→</span></a>
        </div>
      </main>
    `
  });
