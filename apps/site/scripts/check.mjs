import {
  readdir,
  readFile,
  stat
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { landingContent } from '../src/content.mjs';
import { inspectGifPlayback } from '../src/gifPlayback.mjs';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(siteRoot, 'dist');

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(entryPath) : [entryPath];
    })
  );
  return nested.flat();
};

const exists = async (target) => {
  try {
    return (await stat(target)).isFile();
  } catch {
    return false;
  }
};

const htmlFiles = (await walk(outputRoot)).filter((file) =>
  file.endsWith('.html')
);
const failures = [];
const indexedCanonicalUrls = [];

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const ids = new Set(
    [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])
  );
  const hrefs = [...html.matchAll(/\shref="([^"]+)"/g)]
    .map((match) => match[1]);
  for (const href of hrefs) {
    if (
      /^(?:https?:|mailto:)/.test(href) ||
      href === '/' ||
      href.startsWith('/?') ||
      href === '/workbench/' ||
      href.startsWith('/workbench/?')
    ) {
      continue;
    }
    if (href.startsWith('#')) {
      if (!ids.has(href.slice(1))) {
        failures.push(`${file}: missing local anchor ${href}`);
      }
      continue;
    }
    const [pathname, hash] = href.split('#');
    if (!pathname.startsWith('/')) continue;
    const target = pathname.endsWith('/')
      ? path.join(outputRoot, pathname, 'index.html')
      : path.join(outputRoot, pathname);
    if (!(await exists(target))) {
      failures.push(`${file}: missing link target ${href}`);
      continue;
    }
    if (hash && target.endsWith('.html')) {
      const targetHtml = await readFile(target, 'utf8');
      if (!targetHtml.includes(`id="${hash}"`)) {
        failures.push(`${file}: missing target anchor ${href}`);
      }
    }
  }
  if (/localhost|127\.0\.0\.1/.test(html)) {
    failures.push(`${file}: local development origin leaked into output`);
  }
  if (/href="(?:https:\/\/ashfox\.io)?\/workbench\/?/.test(html)) {
    failures.push(`${file}: people must start through the agent setup prompt`);
  }
  const requiredMetadata = [
    '<meta name="description"',
    '<meta name="robots"',
    '<meta property="og:title"',
    '<meta property="og:description"',
    '<meta property="og:url"',
    '<meta property="og:image"',
    '<meta name="twitter:card"',
    '<link rel="canonical"',
    '<script type="application/ld+json">'
  ];
  const isNotFoundPage = path.basename(file) === '404.html';
  for (const metadata of requiredMetadata) {
    if (isNotFoundPage && metadata === '<script type="application/ld+json">') {
      continue;
    }
    if (!html.includes(metadata)) {
      failures.push(`${file}: missing SEO metadata ${metadata}`);
    }
  }
  if (isNotFoundPage) {
    if (!html.includes('<meta name="robots" content="noindex,follow">')) {
      failures.push(`${file}: not-found page must be excluded from search`);
    }
  } else {
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    if (!canonical) {
      failures.push(`${file}: canonical URL is missing`);
    } else {
      indexedCanonicalUrls.push(canonical);
    }
  }
}

const outputFiles = await walk(outputRoot);
if (outputFiles.some((file) => file.endsWith('.map'))) {
  failures.push('source maps must not be present in the static site output');
}
if (!(await exists(path.join(outputRoot, '_headers')))) {
  failures.push('CDN headers file is missing');
}
if (!(await exists(path.join(outputRoot, 'og.png')))) {
  failures.push('social preview image is missing');
} else {
  const socialImage = await readFile(path.join(outputRoot, 'og.png'));
  const width = socialImage.readUInt32BE(16);
  const height = socialImage.readUInt32BE(20);
  if (width !== 1200 || height !== 630) {
    failures.push(
      `social preview image must be 1200x630, received ${width}x${height}`
    );
  }
}
const robotsPath = path.join(outputRoot, 'robots.txt');
const sitemapPath = path.join(outputRoot, 'sitemap.xml');
if (!(await exists(robotsPath))) {
  failures.push('robots.txt is missing');
}
if (!(await exists(sitemapPath))) {
  failures.push('sitemap.xml is missing');
} else {
  const sitemap = await readFile(sitemapPath, 'utf8');
  for (const canonical of indexedCanonicalUrls) {
    if (!sitemap.includes(`<loc>${canonical}</loc>`)) {
      failures.push(`sitemap is missing canonical URL ${canonical}`);
    }
  }
  if (!sitemap.includes('<loc>https://ashfox.io/</loc>')) {
    failures.push('sitemap is missing the landing page');
  }
  if (!sitemap.includes('<loc>https://ashfox.io/workbench/</loc>')) {
    failures.push('sitemap is missing the workbench');
  }
}

const landingHtml = await readFile(path.join(outputRoot, 'index.html'), 'utf8');
const storyChapterCount = (
  landingHtml.match(/\sdata-story-chapter="\d+"/g) ?? []
).length;
if (storyChapterCount !== landingContent.story.length) {
  failures.push(
    `landing story has ${storyChapterCount} chapters, expected ` +
    landingContent.story.length
  );
}
const setupPromptControlCount = (
  landingHtml.match(/\sdata-copy-setup-prompt(?:\s|>)/g) ?? []
).length;
if (setupPromptControlCount !== 3) {
  failures.push(
    `landing has ${setupPromptControlCount} setup prompt controls, expected 3`
  );
}
if (
  !landingHtml.includes(
    'Copy once. Paste into your agent. Describe the asset.'
  ) ||
  !landingHtml.includes('Copy instructions for your AI agent') ||
  !landingHtml.includes(
    'Your agent will ask what you want to create.'
  )
) {
  failures.push('landing must teach the copy, paste, and describe workflow');
}
if (
  !landingContent.quickStart.prompt.includes(
    'direct HTTP request tool available in your environment'
  ) ||
  !landingContent.quickStart.prompt.includes(
    'never navigate the browser to it'
  ) ||
  !landingContent.quickStart.prompt.includes(
    'complete and only ashfox operating guide'
  ) ||
  landingContent.quickStart.prompt.includes('Inspect the current project') ||
  landingContent.quickStart.prompt.includes('What would you like to create?')
) {
  failures.push(
    'setup prompt must delegate the complete workflow to the direct-HTTP manifest'
  );
}
const agentDestinationCount = (
  landingHtml.match(/\sclass="agent-destination"/g) ?? []
).length;
if (
  agentDestinationCount !== 3 ||
  !landingHtml.includes('ChatGPT') ||
  !landingHtml.includes('Cursor') ||
  !landingHtml.includes('Claude')
) {
  failures.push('landing must show the three setup prompt destinations');
}
for (const icon of ['chatgpt.svg', 'cursor.svg', 'claude.svg']) {
  if (!(await exists(path.join(outputRoot, 'icons', icon)))) {
    failures.push(`landing agent destination icon is missing: ${icon}`);
  }
}
if (
  !landingHtml.includes('Codex desktop app') ||
  !landingHtml.includes('Cursor')
) {
  failures.push('landing must name the representative AI agent tools');
}

for (const sequence of landingContent.demo.sequences) {
  const reel = path.join(outputRoot, sequence.reel);
  if (!(await exists(reel))) {
    failures.push(`hero reel is missing: ${sequence.reel}`);
    continue;
  }
  const playback = inspectGifPlayback(await readFile(reel));
  if (playback.repeat !== null) {
    failures.push(`hero reel must play once: ${sequence.reel}`);
  }
  if (playback.durationMs !== sequence.playbackMs) {
    failures.push(
      `hero reel duration mismatch: ${sequence.reel} is ` +
      `${playback.durationMs}ms, configured as ${sequence.playbackMs}ms`
    );
  }
}

if (failures.length > 0) {
  throw new Error(`Static site validation failed:\n${failures.join('\n')}`);
}

console.log(`ashfox static site validation ok: ${htmlFiles.length} pages`);
