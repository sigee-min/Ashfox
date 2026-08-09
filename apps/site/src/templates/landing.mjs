import { landingContent } from '../content.mjs';
import {
  absoluteUrl,
  contributeUrl,
  escapeHtml,
  githubIconButton,
  githubMark,
  githubUrl,
  pageShell
} from './shell.mjs';

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
      </section>

      <section class="section output-section" id="outputs">
        <div class="output-copy" data-reveal>
          <p class="eyebrow"><span></span>Export</p>
          <h2>Canonical source. Runtime-ready output.</h2>
          <p>Keep the plain-text .ashfox Intent Program. The compiler rebuilds the canonical asset on open; export adapters derive target artifacts without changing its source.</p>
          <a class="text-link" href="/docs/guides/save-and-export/">Read the delivery guide <span>→</span></a>
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
