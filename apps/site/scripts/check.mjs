import {
  readdir,
  readFile,
  stat
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { galleryContent, landingContent } from '../src/content.mjs';

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
  const workbenchHrefs = hrefs.filter((href) =>
    /^(?:https:\/\/ashfox\.io)?\/workbench\/?/.test(href)
  );
  const isGalleryPage = file === path.join(
    outputRoot,
    'gallery',
    'index.html'
  );
  if (!isGalleryPage && workbenchHrefs.length > 0) {
    failures.push(`${file}: only gallery demos may link into the workbench`);
  }
  if (
    isGalleryPage &&
    workbenchHrefs.some((href) =>
      !/^\/workbench\/\?project=%2Fdemos%2F[a-z0-9-]+%2Fproject\.ashfox$/.test(href)
    )
  ) {
    failures.push(`${file}: gallery workbench link is not a safe demo path`);
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

const route = '/gallery/';
const galleryPath = path.join(outputRoot, 'gallery', 'index.html');
const galleryHtml = await readFile(galleryPath, 'utf8');
const renderedGalleryIds = [
  ...galleryHtml.matchAll(/\sdata-gallery-id="([^"]+)"/g)
].map((match) => match[1]);
const expectedGalleryIds = galleryContent.items.map((item) => item.galleryId);
if (
  renderedGalleryIds.join('|') !== expectedGalleryIds.join('|') ||
  new Set(renderedGalleryIds).size !== expectedGalleryIds.length
) {
  failures.push('gallery items must be server-rendered once in catalog order');
}
if (
  !galleryHtml.includes('data-gallery-search-input') ||
  !galleryHtml.includes('data-gallery-filter="all"') ||
  !galleryHtml.includes('data-gallery-results') ||
  !galleryHtml.includes('data-gallery-empty')
) {
  failures.push('gallery search, filters, result count, or empty state is missing');
}
for (const category of galleryContent.categories) {
  if (!galleryHtml.includes(`data-gallery-filter="${category}"`)) {
    failures.push(`gallery category filter is missing: ${category}`);
  }
}
const playerCount = (
  galleryHtml.match(/\sdata-gallery-player(?:\s|>)/g) ?? []
).length;
if (playerCount !== 1) {
  failures.push(`${route} must contain exactly one shared GIF player`);
}
if (/\ssrc="[^"]+\.gif(?:[?#][^"]*)?"/.test(galleryHtml)) {
  failures.push(`${route} must start from posters without loading a GIF`);
}
if (
  !galleryHtml.includes(
    '<link rel="canonical" href="https://ashfox.io/gallery/">'
  )
) {
  failures.push(`${route} canonical URL is incorrect`);
}
for (const item of galleryContent.items) {
  if (
    !galleryHtml.includes(`data-gif="${item.gif}"`) ||
    !galleryHtml.includes(`href="${item.workbench}"`) ||
    !galleryHtml.includes(item.agent.model) ||
    item.tags.some((tag) => !galleryHtml.includes(`>${tag}</span>`))
  ) {
    failures.push(`${route} is missing gallery metadata for ${item.galleryId}`);
  }
  for (const [label, value] of [
    ['description', item.description],
    ['prompt', item.prompt],
    ['detail', item.detail],
    ['reasoning', item.agent.reasoning]
  ]) {
    if (galleryHtml.includes(value)) {
      failures.push(
        `${route} must not render ${label} for ${item.galleryId}`
      );
    }
  }
  const gifPath = path.join(outputRoot, item.gif);
  if (!(await exists(gifPath))) {
    failures.push(`gallery GIF is missing: ${item.gif}`);
    continue;
  }
  const signature = (await readFile(gifPath)).subarray(0, 6).toString('ascii');
  if (signature !== 'GIF87a' && signature !== 'GIF89a') {
    failures.push(`gallery preview is not a GIF file: ${item.gif}`);
  }
  const manifestPath = path.join(outputRoot, item.manifest);
  if (!(await exists(manifestPath))) {
    failures.push(`gallery manifest is missing: ${item.manifest}`);
  } else {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (manifest.schemaVersion !== 1 || manifest.id !== item.galleryId) {
      failures.push(`gallery manifest identity is invalid: ${item.manifest}`);
    }
  }
  const projectPath = path.join(outputRoot, item.project);
  if (!(await exists(projectPath))) {
    failures.push(`gallery project is missing: ${item.project}`);
  } else {
    const archive = await readFile(projectPath);
    if (
      archive.subarray(0, 4).toString('hex') !== '504b0304' ||
      !archive.includes(Buffer.from('manifest.json')) ||
      !archive.includes(Buffer.from('project.json'))
    ) {
      failures.push(`gallery project is not an ashfox archive: ${item.project}`);
    }
  }
}
const galleryIndexPath = path.join(outputRoot, 'demos', 'index.json');
if (!(await exists(galleryIndexPath))) {
  failures.push('gallery JSON index is missing');
} else {
  const galleryIndex = JSON.parse(await readFile(galleryIndexPath, 'utf8'));
  const indexIds = galleryIndex.demos?.map((item) => item.id) ?? [];
  if (
    galleryIndex.schemaVersion !== 1 ||
    indexIds.join('|') !== expectedGalleryIds.join('|')
  ) {
    failures.push('gallery JSON index does not match the catalog');
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
  !landingHtml.includes(
    'One instruction. Then describe what you want.'
  ) ||
  !landingHtml.includes('Copy the manifest instruction') ||
  !landingHtml.includes(
    'Your agent will ask what you want to create.'
  )
) {
  failures.push('landing must teach the copy, paste, and describe workflow');
}
if (
  landingContent.quickStart.instruction !==
  'Fetch and follow https://ashfox.io/workbench/agent-manifest.json using a direct HTTP request such as curl.'
) {
  failures.push(
    'the copied instruction must delegate the complete workflow to one manifest'
  );
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
const agentDestinationCount = (
  landingHtml.match(/\sclass="agent-destination"/g) ?? []
).length;
if (
  agentDestinationCount !== 3 ||
  !landingHtml.includes('ChatGPT') ||
  !landingHtml.includes('Cursor') ||
  !landingHtml.includes('Claude')
) {
  failures.push('landing must show the three agent instruction destinations');
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
if (
  landingHtml.includes('>Examples</a>') ||
  !landingHtml.includes('href="/gallery/">Gallery</a>')
) {
  failures.push('site navigation must link to the gallery');
}

const heroPlayerCount = (
  landingHtml.match(/\sdata-demo-player(?:\s|>)/g) ?? []
).length;
if (heroPlayerCount !== 1) {
  failures.push(`landing must contain one hero player, received ${heroPlayerCount}`);
}
if (/data-demo-reel|data-story-/.test(landingHtml)) {
  failures.push('cut landing showcase DOM must not be present');
}
if (/media\/showcase\/[^"']+\.gif/.test(landingHtml)) {
  failures.push('landing must not reference legacy showcase GIF media');
}
const videoTags = landingHtml.match(/<video[\s\S]*?<\/video>/g) ?? [];
if (videoTags.length !== 0) {
  failures.push('landing must not retain the legacy video player');
}

const mediaSources = new Set([
  ...landingContent.demo.sequences.map((sequence) => sequence.gif)
]);
if (
  landingContent.demo.sequences.length !== 1 ||
  !landingContent.demo.sequences[0]?.gif.endsWith(
    '/blackfrost-dreadwing/build.gif'
  )
) {
  failures.push('landing must use the current Blackfrost build-process GIF');
}
for (const source of mediaSources) {
  const mediaPath = path.join(outputRoot, source);
  if (!(await exists(mediaPath))) {
    failures.push(`landing build GIF is missing: ${source}`);
    continue;
  }
  const media = await readFile(mediaPath);
  const signature = media.subarray(0, 6).toString('ascii');
  if (signature !== 'GIF87a' && signature !== 'GIF89a') {
    failures.push(`landing build media is not a GIF file: ${source}`);
  }
}

const siteScriptSource = landingHtml.match(
  /<script type="module" src="([^"]+)"/
)?.[1];
if (!siteScriptSource) {
  failures.push('landing module script is missing');
} else {
  const siteScript = await readFile(path.join(outputRoot, siteScriptSource), 'utf8');
  if (/Date\.now\(\)|[?&]run=/.test(siteScript)) {
    failures.push('landing script must not restart media with unique URLs');
  }
  for (const moduleName of ['landingPlayback', 'gallery']) {
    const moduleImport = siteScript.match(
      new RegExp(`from ['"]\\./(${moduleName}-[a-f0-9]+\\.js)['"]`)
    )?.[1];
    if (!moduleImport) {
      failures.push(`site script must import the hashed ${moduleName} module`);
    } else if (!(await exists(path.join(outputRoot, 'assets', moduleImport)))) {
      failures.push(`hashed site module is missing: ${moduleImport}`);
    }
  }
}

if (failures.length > 0) {
  throw new Error(`Static site validation failed:\n${failures.join('\n')}`);
}

console.log(`ashfox static site validation ok: ${htmlFiles.length} pages`);
