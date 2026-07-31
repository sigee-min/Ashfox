import {
  readdir,
  readFile,
  stat
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { galleryContent, landingContent } from '../src/content.mjs';
import { selectStoryChapter } from '../src/landingPlayback.js';

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
  if (/localhost|127\.0\.0\.1/.test(html)) {
    failures.push(`${file}: local development origin leaked into output`);
  }
  if (/href="(?:https:\/\/ashfox\.io)?\/workbench\/?/.test(html)) {
    failures.push(`${file}: people must start through the agent instruction`);
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

const galleryPageCount = Math.ceil(
  galleryContent.items.length / galleryContent.pageSize
);
const renderedGalleryIds = [];
for (let pageIndex = 0; pageIndex < galleryPageCount; pageIndex += 1) {
  const route = pageIndex === 0
    ? '/gallery/'
    : `/gallery/page/${pageIndex + 1}/`;
  const galleryPath = path.join(outputRoot, route, 'index.html');
  if (!(await exists(galleryPath))) {
    failures.push(`gallery page is missing: ${route}`);
    continue;
  }
  const html = await readFile(galleryPath, 'utf8');
  const expectedItems = galleryContent.items.slice(
    pageIndex * galleryContent.pageSize,
    (pageIndex + 1) * galleryContent.pageSize
  );
  const ids = [...html.matchAll(/\sdata-gallery-id="([^"]+)"/g)]
    .map((match) => match[1]);
  renderedGalleryIds.push(...ids);
  if (ids.length !== expectedItems.length) {
    failures.push(
      `${route} has ${ids.length} gallery cards, expected ${expectedItems.length}`
    );
  }
  if (ids.join('|') !== expectedItems.map((item) => item.galleryId).join('|')) {
    failures.push(`${route} gallery item order does not match the catalog`);
  }
  const playerCount = (
    html.match(/\sdata-gallery-player(?:\s|>)/g) ?? []
  ).length;
  if (playerCount !== 1) {
    failures.push(`${route} must contain exactly one GIF player`);
  }
  if (/\ssrc="[^"]+\.gif(?:[?#][^"]*)?"/.test(html)) {
    failures.push(`${route} must start from posters without loading a GIF`);
  }
  for (const item of expectedItems) {
    if (
      !html.includes(`data-gif="${item.gif}"`) ||
      !html.includes(item.agent.model) ||
      !html.includes(item.agent.reasoning)
    ) {
      failures.push(`${route} is missing gallery metadata for ${item.galleryId}`);
    }
  }
  const canonical = `https://ashfox.io${route}`;
  if (!html.includes(`<link rel="canonical" href="${canonical}">`)) {
    failures.push(`${route} canonical URL is incorrect`);
  }
  if (pageIndex > 0) {
    const previousRoute = pageIndex === 1
      ? '/gallery/'
      : `/gallery/page/${pageIndex}/`;
    if (!html.includes(
      `<link rel="prev" href="https://ashfox.io${previousRoute}">`
    )) {
      failures.push(`${route} is missing its previous-page relation`);
    }
  }
  if (pageIndex < galleryPageCount - 1) {
    const nextRoute = `/gallery/page/${pageIndex + 2}/`;
    if (!html.includes(
      `<link rel="next" href="https://ashfox.io${nextRoute}">`
    )) {
      failures.push(`${route} is missing its next-page relation`);
    }
  }
}
const expectedGalleryIds = galleryContent.items.map((item) => item.galleryId);
if (
  new Set(renderedGalleryIds).size !== expectedGalleryIds.length ||
  renderedGalleryIds.some((id) => !expectedGalleryIds.includes(id))
) {
  failures.push('gallery items must be rendered exactly once across all pages');
}
for (const item of galleryContent.items) {
  const gifPath = path.join(outputRoot, item.gif);
  if (!(await exists(gifPath))) {
    failures.push(`gallery GIF is missing: ${item.gif}`);
    continue;
  }
  const signature = (await readFile(gifPath)).subarray(0, 6).toString('ascii');
  if (signature !== 'GIF87a' && signature !== 'GIF89a') {
    failures.push(`gallery preview is not a GIF file: ${item.gif}`);
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
const storyPlayerCount = (
  landingHtml.match(/\sdata-story-player(?:\s|>)/g) ?? []
).length;
if (heroPlayerCount !== 1 || storyPlayerCount !== 1) {
  failures.push(
    `landing must contain one hero and one story player, received ` +
    `${heroPlayerCount} and ${storyPlayerCount}`
  );
}
if (/data-demo-reel|data-story-media|data-story-src/.test(landingHtml)) {
  failures.push('legacy GIF playback DOM must not be present');
}
if (/media\/showcase\/[^"']+\.gif/.test(landingHtml)) {
  failures.push('landing runtime must not reference animated GIF media');
}
const videoTags = landingHtml.match(/<video[\s\S]*?<\/video>/g) ?? [];
if (
  videoTags.length !== 2 ||
  videoTags.some((tag) =>
    !tag.includes('muted') ||
    !tag.includes('playsinline') ||
    !tag.includes('preload="metadata"') ||
    /\s(?:autoplay|loop)(?:\s|>)/.test(tag)
  )
) {
  failures.push('landing videos must use the controlled playback contract');
}

const mediaSources = new Set([
  ...landingContent.demo.sequences.map((sequence) => sequence.video),
  ...landingContent.story.map((chapter) => chapter.video)
]);
for (const source of mediaSources) {
  const mediaPath = path.join(outputRoot, source);
  if (!(await exists(mediaPath))) {
    failures.push(`landing video is missing: ${source}`);
    continue;
  }
  const media = await readFile(mediaPath);
  if (media.subarray(4, 8).toString('ascii') !== 'ftyp') {
    failures.push(`landing video is not an MP4 file: ${source}`);
  }
  const movieAtom = media.indexOf(Buffer.from('moov'));
  const mediaAtom = media.indexOf(Buffer.from('mdat'));
  if (movieAtom < 0 || mediaAtom < 0 || movieAtom > mediaAtom) {
    failures.push(`landing video must be encoded for fast start: ${source}`);
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

const selectionFixtures = [
  { top: 0, bottom: 400 },
  { top: 300, bottom: 700 }
];
if (selectStoryChapter(selectionFixtures, 800) !== 1) {
  failures.push('story selection must choose the chapter nearest viewport center');
}
if (selectStoryChapter(selectionFixtures, 800, 0, 120) !== 0) {
  failures.push('story selection hysteresis must prevent boundary flicker');
}
if (
  selectStoryChapter([
    { top: -900, bottom: -500 },
    { top: -400, bottom: 0 },
    { top: 100, bottom: 700 }
  ], 800) !== 2
) {
  failures.push('fast scrolling must resolve directly to the final visible chapter');
}

if (failures.length > 0) {
  throw new Error(`Static site validation failed:\n${failures.join('\n')}`);
}

console.log(`ashfox static site validation ok: ${htmlFiles.length} pages`);
