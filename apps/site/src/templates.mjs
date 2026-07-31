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
    data-empty-src="/media/showcase/empty-workspace.jpg"
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
      <video
        class="studio-playback"
        data-demo-player
        data-media-state="poster"
        muted
        playsinline
        preload="metadata"
        aria-hidden="true"
      ></video>
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
        <span class="agent-model"><b>5.6 Sol</b><em>xhigh</em><i>⌄</i></span>
        <span class="agent-mic" aria-hidden="true"></span>
        <button class="agent-send" type="button" tabindex="-1" disabled aria-label="Prompt runs automatically">
          <b aria-hidden="true">↑</b>
        </button>
      </div>
    </div>
  </div>
`;

const landingStory = ({ story }) => `
  <section
    class="story-section"
    id="showcase"
    data-scroll-story
    data-sequences="${escapeHtml(JSON.stringify(story))}"
  >
    <div class="story-intro" data-reveal>
      <p class="eyebrow"><span></span>One coherent workflow</p>
      <h2><span>One request.</span><span>A complete asset.</span></h2>
      <p>Follow the result from editable structure to authored motion.</p>
    </div>
    <div class="story-track">
      <span class="story-axis" aria-hidden="true"><i></i></span>
      <div class="story-stage">
        <div
          class="story-frame"
          data-story-desktop-host
          role="img"
          aria-label="${escapeHtml(story[0].alt)}"
        >
          <img
            class="story-poster"
            src="${escapeHtml(story[0].poster)}"
            data-story-desktop-poster
            width="1280"
            height="720"
            alt=""
            aria-hidden="true"
          >
          <video
            class="story-playback"
            data-story-player
            data-media-state="poster"
            muted
            playsinline
            preload="metadata"
            aria-hidden="true"
          ></video>
        </div>
        <div class="story-stage-meta" aria-hidden="true">
          <span data-story-position>01 / 0${story.length}</span>
          <span>Actual ashfox output</span>
        </div>
      </div>
      <div class="story-chapters">
        ${story.map((chapter, index) => `
          <article
            class="story-chapter ${index % 2 === 0 ? 'story-chapter-left' : 'story-chapter-right'}"
            data-story-chapter="${index}"
          >
            <div
              class="story-mobile-media"
              data-story-mobile-host="${index}"
              role="img"
              aria-label="${escapeHtml(chapter.alt)}"
            >
              <img
                class="story-poster"
                src="${escapeHtml(chapter.poster)}"
                width="1280"
                height="720"
                alt=""
                aria-hidden="true"
                loading="lazy"
              >
            </div>
            <div class="story-copy">
              <span>0${index + 1} · ${escapeHtml(chapter.eyebrow)}</span>
              <h3>${escapeHtml(chapter.title)}</h3>
              <p>${escapeHtml(chapter.body)}</p>
              <small>${escapeHtml(chapter.detail)}</small>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  </section>
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

      ${landingStory({ story: content.story })}

      <section class="section output-section" id="outputs">
        <div class="output-copy" data-reveal>
          <p class="eyebrow"><span></span>Export</p>
          <h2>Ready for the game.</h2>
          <p>Export the same finished project for Minecraft or any supported 3D pipeline.</p>
          <a class="text-link" href="/docs/guides/save-and-export/">Export guide <span>→</span></a>
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

export const galleryPageRoute = (pageIndex) =>
  pageIndex === 0 ? '/gallery/' : `/gallery/page/${pageIndex + 1}/`;

const galleryPagination = ({ currentPage, pageCount }) => pageCount < 2
  ? ''
  : `
  <nav class="gallery-pagination" aria-label="Gallery pages">
    ${currentPage > 0
      ? `<a class="gallery-page-direction" href="${galleryPageRoute(currentPage - 1)}" rel="prev">← Previous</a>`
      : '<span class="gallery-page-direction" aria-disabled="true">← Previous</span>'}
    <span class="gallery-pages">
      ${Array.from({ length: pageCount }, (_, pageIndex) => `
        <a
          href="${galleryPageRoute(pageIndex)}"
          ${pageIndex === currentPage ? 'aria-current="page"' : ''}
          aria-label="Gallery page ${pageIndex + 1}"
        >${pageIndex + 1}</a>
      `).join('')}
    </span>
    ${currentPage < pageCount - 1
      ? `<a class="gallery-page-direction" href="${galleryPageRoute(currentPage + 1)}" rel="next">Next →</a>`
      : '<span class="gallery-page-direction" aria-disabled="true">Next →</span>'}
  </nav>
`;

const galleryCard = (item, index) => `
  <article class="gallery-card">
    <button
      class="gallery-preview"
      type="button"
      data-gallery-card
      data-gallery-id="${escapeHtml(item.galleryId)}"
      data-gif="${escapeHtml(item.gif)}"
      data-preview-state="poster"
      aria-label="Watch ${escapeHtml(item.name)} build process"
      aria-pressed="false"
    >
      <span
        class="gallery-media"
        data-gallery-media
        role="img"
        aria-label="${escapeHtml(item.alt)}"
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
        <span class="gallery-category">${escapeHtml(item.category)}</span>
        <span class="gallery-preview-state" aria-hidden="true">
          <i></i><b>Watch build</b>
        </span>
      </span>
    </button>
    <div class="gallery-card-copy">
      <span>${escapeHtml(item.phase)}</span>
      <h2>${escapeHtml(item.name)}</h2>
      <p>${escapeHtml(item.description)}</p>
      <small>${escapeHtml(item.detail)}</small>
      <dl class="gallery-metadata">
        <div><dt>Model</dt><dd>${escapeHtml(item.agent.model)}</dd></div>
        <div><dt>Reasoning</dt><dd>${escapeHtml(item.agent.reasoning)}</dd></div>
      </dl>
    </div>
  </article>
`;

export const renderGalleryPage = ({ assets, config, pageIndex }) => {
  const content = galleryContent;
  const pageCount = Math.ceil(content.items.length / content.pageSize);
  if (pageIndex < 0 || pageIndex >= pageCount) {
    throw new Error(`Gallery page is out of range: ${pageIndex + 1}`);
  }
  const start = pageIndex * content.pageSize;
  const items = content.items.slice(start, start + content.pageSize);
  const path = galleryPageRoute(pageIndex);
  const body = `
    <main class="gallery" id="main" data-gallery>
      <header class="gallery-hero">
        <p class="eyebrow"><span></span>${escapeHtml(content.eyebrow)}</p>
        <h1>${escapeHtml(content.title)}</h1>
        <p>${escapeHtml(content.summary)}</p>
      </header>
      <section
        class="gallery-grid"
        aria-label="ashfox showcase assets"
      >
        ${items.map(galleryCard).join('')}
      </section>
      ${galleryPagination({ currentPage: pageIndex, pageCount })}
    </main>
  `;
  const previousPath = pageIndex > 0
    ? galleryPageRoute(pageIndex - 1)
    : null;
  const nextPath = pageIndex < pageCount - 1
    ? galleryPageRoute(pageIndex + 1)
    : null;
  const headLinks = [
    previousPath
      ? `<link rel="prev" href="${escapeHtml(absoluteUrl(config.siteOrigin, previousPath))}">`
      : '',
    nextPath
      ? `<link rel="next" href="${escapeHtml(absoluteUrl(config.siteOrigin, nextPath))}">`
      : ''
  ].filter(Boolean).join('\n');

  return pageShell({
    active: 'gallery',
    assets,
    body,
    config,
    description: content.summary,
    headLinks,
    path,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: pageIndex === 0
        ? 'ashfox gallery'
        : `ashfox gallery — page ${pageIndex + 1}`,
      url: absoluteUrl(config.siteOrigin, path),
      description: content.summary,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: items.map((item, index) => ({
          '@type': 'ListItem',
          position: start + index + 1,
          item: {
            '@type': 'CreativeWork',
            name: `${item.name} — ${item.phase}`,
            description: item.description,
            image: absoluteUrl(config.siteOrigin, item.poster)
          }
        }))
      }
    },
    title: pageIndex === 0
      ? 'Gallery'
      : `Gallery — Page ${pageIndex + 1}`
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
