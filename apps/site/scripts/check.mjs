import {
  readdir,
  readFile,
  stat
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { landingContent } from '../src/content.mjs';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(siteRoot, '../..');
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

const failures = [];
const htmlFiles = (await walk(outputRoot)).filter((file) =>
  file.endsWith('.html')
);
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
  const sources = [...html.matchAll(/\ssrc="([^"]+)"/g)]
    .map((match) => match[1]);
  for (const source of sources) {
    if (/^(?:https?:|data:)/.test(source)) continue;
    const pathname = source.split(/[?#]/)[0];
    if (!pathname.startsWith('/')) continue;
    if (!(await exists(path.join(outputRoot, pathname)))) {
      failures.push(`${file}: missing source asset ${source}`);
    }
  }
  if (/localhost|127\.0\.0\.1/.test(html)) {
    failures.push(`${file}: local development origin leaked into output`);
  }
  if (/\/gallery\/|\/demos\/|data-agent-demo|data-scroll-story/.test(html)) {
    failures.push(`${file}: retired gallery or demo markup is published`);
  }
  const requiredMetadata = [
    '<meta name="description"',
    '<meta name="robots"',
    '<meta property="og:title"',
    '<meta property="og:description"',
    '<meta property="og:url"',
    '<meta property="og:image"',
    '<meta name="twitter:card"',
    '<link rel="canonical"'
  ];
  const isNotFoundPage = path.basename(file) === '404.html';
  for (const metadata of requiredMetadata) {
    if (!html.includes(metadata)) {
      failures.push(`${file}: missing SEO metadata ${metadata}`);
    }
  }
  if (!isNotFoundPage) {
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    if (!canonical) failures.push(`${file}: canonical URL is missing`);
    else indexedCanonicalUrls.push(canonical);
  }
}

const outputFiles = await walk(outputRoot);
if (outputFiles.some((file) => file.endsWith('.map'))) {
  failures.push('source maps must not be present in the static site output');
}
for (const required of ['_headers', 'og.png', 'robots.txt', 'sitemap.xml']) {
  if (!(await exists(path.join(outputRoot, required)))) {
    failures.push(`static site output is missing ${required}`);
  }
}
for (const retiredDirectory of ['gallery', 'demos']) {
  try {
    if ((await stat(path.join(outputRoot, retiredDirectory))).isDirectory()) {
      failures.push(`retired ${retiredDirectory} output is still published`);
    }
  } catch {
    // Absence is the required hardcut state.
  }
}

const sitemapPath = path.join(outputRoot, 'sitemap.xml');
if (await exists(sitemapPath)) {
  const sitemap = await readFile(sitemapPath, 'utf8');
  for (const canonical of indexedCanonicalUrls) {
    if (!sitemap.includes(`<loc>${canonical}</loc>`)) {
      failures.push(`sitemap is missing canonical URL ${canonical}`);
    }
  }
  if (sitemap.includes('/gallery/') || sitemap.includes('/demos/')) {
    failures.push('sitemap still publishes retired gallery or demo routes');
  }
}

const landingHtml = await readFile(path.join(outputRoot, 'index.html'), 'utf8');
const agentInstructionControlCount = (
  landingHtml.match(/\sdata-copy-agent-instruction(?:\s|>)/g) ?? []
).length;
if (agentInstructionControlCount !== 3) {
  failures.push(
    `landing has ${agentInstructionControlCount} agent instruction controls, expected 3`
  );
}
if (
  !landingHtml.includes('One instruction. Then describe what you want.') ||
  !landingHtml.includes('Copy the manifest instruction') ||
  !landingHtml.includes('Your agent will ask what you want to create.')
) {
  failures.push('landing must teach the copy, paste, and describe workflow');
}
for (const documentationPath of [
  'README.md',
  'docs/guides/ai-agent-quick-start.md'
]) {
  const documentation = await readFile(
    path.join(repositoryRoot, documentationPath),
    'utf8'
  );
  const occurrenceCount = documentation
    .split(landingContent.quickStart.instruction).length - 1;
  if (occurrenceCount !== 1) {
    failures.push(
      `${documentationPath} must contain the canonical agent instruction exactly once`
    );
  }
}
const siteScriptSource = landingHtml.match(
  /<script type="module" src="([^"]+)"/
)?.[1];
if (!siteScriptSource) {
  failures.push('landing module script is missing');
} else {
  const siteScript = await readFile(path.join(outputRoot, siteScriptSource), 'utf8');
  if (/landingPlayback|gallery/.test(siteScript)) {
    failures.push('site script still imports retired gallery or demo playback');
  }
}

if (failures.length > 0) {
  throw new Error(`Static site validation failed:\n${failures.join('\n')}`);
}

console.log(`ashfox static site validation ok: ${htmlFiles.length} pages`);
