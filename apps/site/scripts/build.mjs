import { createHash } from 'node:crypto';
import {
  cp,
  mkdir,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadDocumentation } from '../src/docs.mjs';
import {
  renderDocumentationPage,
  renderLandingPage,
  renderNotFoundPage
} from '../src/templates.mjs';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(siteRoot, '..', '..');
const docsRoot = path.join(repoRoot, 'docs');
const sourceRoot = path.join(siteRoot, 'src');
const publicRoot = path.join(siteRoot, 'public');
const outputRoot = path.join(siteRoot, 'dist');

const normalizeOrigin = (value) => {
  if (!value) return '';
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('ASHFOX_SITE_ORIGIN must use HTTP or HTTPS.');
  }
  return url.origin;
};

const studioUrl = process.env.ASHFOX_STUDIO_URL?.trim() || '/studio/';
const siteOrigin = normalizeOrigin(
  process.env.ASHFOX_SITE_ORIGIN?.trim() || ''
);

const hashedAsset = async (sourceName) => {
  const bytes = await readFile(path.join(sourceRoot, sourceName));
  const extension = path.extname(sourceName);
  const name = path.basename(sourceName, extension);
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  const outputName = `${name}-${hash}${extension}`;
  await writeFile(path.join(outputRoot, 'assets', outputName), bytes);
  return `/assets/${outputName}`;
};

const writeRoute = async (route, html) => {
  const relative = route === '/'
    ? 'index.html'
    : path.join(route.replace(/^\/|\/$/g, ''), 'index.html');
  const destination = path.join(outputRoot, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, html);
};

await rm(outputRoot, { recursive: true, force: true });
await mkdir(path.join(outputRoot, 'assets'), { recursive: true });

const assets = {
  css: await hashedAsset('site.css'),
  js: await hashedAsset('site.js')
};
const config = { siteOrigin, studioUrl };
const documents = await loadDocumentation(docsRoot);

await writeRoute('/', renderLandingPage({ assets, config }));
for (const document of documents) {
  await writeRoute(
    document.route,
    renderDocumentationPage({ assets, config, document, documents })
  );
}
await writeFile(
  path.join(outputRoot, '404.html'),
  renderNotFoundPage({ assets, config })
);
await cp(publicRoot, outputRoot, { recursive: true });
await writeFile(
  path.join(outputRoot, '_headers'),
  `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()

/*.html
  Cache-Control: public, max-age=0, must-revalidate

/docs/*
  Cache-Control: public, max-age=0, must-revalidate

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/og.png
  Cache-Control: public, max-age=86400

/media/*
  Cache-Control: public, max-age=604800
`
);
await writeFile(
  path.join(outputRoot, '_redirects'),
  `/docs /docs/ 301
`
);
await writeFile(
  path.join(outputRoot, 'robots.txt'),
  `User-agent: *
Allow: /
`
);

console.log(
  `ashfox static site built: ${documents.length} docs, ${outputRoot}`
);
