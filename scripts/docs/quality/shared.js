/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const docsRoot = path.join(repoRoot, 'apps', 'docs', 'content', 'docs');
const pairExceptionPath = path.join(repoRoot, 'config', 'docs', 'i18n-pair-exceptions.json');

const locales = ['en', 'ko'];
const docExtensions = new Set(['.md', '.mdx']);

function toPosixPath(value) {
  return value.split(path.sep).join('/');
}

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
      continue;
    }

    if (entry.isFile() && docExtensions.has(path.extname(entry.name))) {
      out.push(fullPath);
    }
  }
}

function listDocFiles(locale) {
  const localeRoot = path.join(docsRoot, locale);
  const files = [];
  walk(localeRoot, files);
  return files;
}

function routeFromFile(locale, filePath) {
  const localeRoot = path.join(docsRoot, locale);
  let relative = toPosixPath(path.relative(localeRoot, filePath));
  relative = relative.replace(/\.(md|mdx)$/i, '');
  if (relative.endsWith('/index')) {
    relative = relative.slice(0, -'/index'.length);
  }
  return relative;
}

function parseFrontmatter(content) {
  const normalized = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const lines = normalized.split(/\r?\n/);
  if (lines[0] !== '---') {
    return null;
  }

  let closeIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === '---') {
      closeIndex = index;
      break;
    }
  }

  if (closeIndex === -1) {
    return null;
  }

  const yamlLines = lines.slice(1, closeIndex);
  return {
    values: yamlLines,
    body: lines.slice(closeIndex + 1).join('\n'),
  };
}

function hasFrontmatterKey(frontmatterLines, key) {
  const prefix = `${key}:`;
  return frontmatterLines.some((line) => line.trimStart().startsWith(prefix));
}

function stripQueryAndHash(target) {
  return target.split('#')[0].split('?')[0];
}

function normalizeLinkTarget(target) {
  let value = target.trim();
  if (value.startsWith('<') && value.endsWith('>')) {
    value = value.slice(1, -1);
  }
  if (!value) return value;
  return stripQueryAndHash(value);
}

function isExternalTarget(target) {
  return (
    target.startsWith('http://') ||
    target.startsWith('https://') ||
    target.startsWith('mailto:') ||
    target.startsWith('tel:')
  );
}

function hasAnyExtension(targetPath) {
  const extension = path.extname(targetPath);
  return extension.length > 0;
}

function candidateDocPaths(basePath) {
  if (hasAnyExtension(basePath)) {
    return [basePath];
  }

  return [
    `${basePath}.mdx`,
    `${basePath}.md`,
    path.join(basePath, 'index.mdx'),
    path.join(basePath, 'index.md'),
  ];
}

function resolveAbsoluteDocsUrl(target) {
  const match = target.match(/^\/(en|ko)\/docs(?:\/(.*))?$/);
  if (!match) return null;

  const locale = match[1];
  const route = (match[2] || '').replace(/\/+$/g, '');
  const base = path.join(docsRoot, locale, route);

  for (const candidate of candidateDocPaths(base)) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function resolveRelativeDocsUrl(filePath, target) {
  const cleaned = normalizeLinkTarget(target);
  if (!cleaned) return null;

  const basePath = path.resolve(path.dirname(filePath), cleaned);
  for (const candidate of candidateDocPaths(basePath)) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function extractLineLinks(line) {
  const links = [];

  const markdownPattern = /\[[^\]]+\]\(([^)]+)\)/g;
  let markdownMatch;
  while ((markdownMatch = markdownPattern.exec(line)) !== null) {
    const raw = markdownMatch[1].trim().split(/\s+/)[0];
    links.push(raw);
  }

  const hrefPattern = /href=(?:"([^"]+)"|'([^']+)')/g;
  let hrefMatch;
  while ((hrefMatch = hrefPattern.exec(line)) !== null) {
    links.push(hrefMatch[1] || hrefMatch[2]);
  }

  return links;
}

function extractLinks(content) {
  const lines = content.split(/\r?\n/);
  const links = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineLinks = extractLineLinks(line);

    for (const target of lineLinks) {
      links.push({
        target,
        line: index + 1,
      });
    }
  }

  return links;
}

function globToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*');

  return new RegExp(`^${escaped}$`);
}

function loadPairIgnorePatterns() {
  if (!fs.existsSync(pairExceptionPath)) return [];

  const payload = JSON.parse(fs.readFileSync(pairExceptionPath, 'utf8'));
  if (!payload || !Array.isArray(payload.ignore)) return [];

  return payload.ignore;
}

function isIgnoredByPatterns(route, patterns) {
  return patterns.some((pattern) => globToRegex(pattern).test(route));
}

module.exports = {
  docsRoot,
  locales,
  listDocFiles,
  routeFromFile,
  parseFrontmatter,
  hasFrontmatterKey,
  normalizeLinkTarget,
  isExternalTarget,
  resolveAbsoluteDocsUrl,
  resolveRelativeDocsUrl,
  extractLinks,
  loadPairIgnorePatterns,
  isIgnoredByPatterns,
  toPosixPath,
};
