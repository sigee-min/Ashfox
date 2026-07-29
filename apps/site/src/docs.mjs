import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { marked } from 'marked';

import { sectionOrder } from './content.mjs';

const markdownExtension = /\.md$/i;

const toPosix = (value) => value.split(path.sep).join('/');

const walkMarkdown = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return walkMarkdown(entryPath);
      return markdownExtension.test(entry.name) ? [entryPath] : [];
    })
  );
  return files.flat();
};

export const slugify = (value) =>
  value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';

export const routeForDocument = (relativePath) => {
  const normalized = toPosix(relativePath);
  if (normalized.toLowerCase() === 'readme.md') return '/docs/';
  return `/docs/${normalized.replace(markdownExtension, '')}/`;
};

const titleFromMarkdown = (markdown, fallback) => {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
};

const descriptionFromMarkdown = (markdown) => {
  const paragraphs = markdown
    .replace(/```[\s\S]*?```/g, '')
    .split(/\n\s*\n/)
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter(
      (value) =>
        value.length > 30 &&
        !value.startsWith('#') &&
        !value.startsWith('- ') &&
        !value.startsWith('|') &&
        !value.startsWith('Status:')
    );
  return (paragraphs[0] ?? 'Ashfox product and architecture documentation.')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '');
};

const rewriteMarkdownLinks = (markdown, relativePath) =>
  markdown.replace(
    /\]\(([^)\s]+\.md)(#[^)]+)?\)/g,
    (_match, targetPath, hash = '') => {
      const resolved = path.posix.normalize(
        path.posix.join(path.posix.dirname(toPosix(relativePath)), targetPath)
      );
      const anchor = hash ? `#${slugify(decodeURIComponent(hash.slice(1)))}` : '';
      return `](${routeForDocument(resolved)}${anchor})`;
    }
  );

const addHeadingIds = (html) => {
  const counts = new Map();
  const toc = [];
  const content = html.replace(
    /<h([1-4])>([\s\S]*?)<\/h\1>/g,
    (_match, levelValue, inner) => {
      const level = Number(levelValue);
      const text = inner.replace(/<[^>]*>/g, '').trim();
      const base = slugify(text);
      const count = (counts.get(base) ?? 0) + 1;
      counts.set(base, count);
      const id = count === 1 ? base : `${base}-${count}`;
      if (level >= 2) toc.push({ id, level, text });
      return `<h${level} id="${id}">${inner}</h${level}>`;
    }
  );
  return {
    html: content.replace(
      /<p>Status: <strong>([^<]+)<\/strong><\/p>/,
      '<p class="doc-status"><span>Status</span>$1</p>'
    ),
    toc
  };
};

const sectionForPath = (relativePath) => {
  const normalized = toPosix(relativePath);
  return normalized.toLowerCase() === 'readme.md'
    ? 'overview'
    : normalized.split('/')[0];
};

const sectionRank = (section) => {
  const index = sectionOrder.indexOf(section);
  return index === -1 ? sectionOrder.length : index;
};

export const loadDocumentation = async (docsRoot) => {
  const files = await walkMarkdown(docsRoot);
  const documents = await Promise.all(
    files.map(async (filePath) => {
      const relativePath = toPosix(path.relative(docsRoot, filePath));
      const markdown = await readFile(filePath, 'utf8');
      const title = titleFromMarkdown(
        markdown,
        path.basename(relativePath, '.md')
      );
      const rendered = addHeadingIds(
        marked.parse(rewriteMarkdownLinks(markdown, relativePath), {
          gfm: true
        })
      );
      return {
        relativePath,
        route: routeForDocument(relativePath),
        section: sectionForPath(relativePath),
        title,
        description: descriptionFromMarkdown(markdown),
        html: rendered.html,
        toc: rendered.toc
      };
    })
  );
  return documents.sort((left, right) => {
    const sectionDifference =
      sectionRank(left.section) - sectionRank(right.section);
    if (sectionDifference !== 0) return sectionDifference;
    if (left.route === '/docs/') return -1;
    if (right.route === '/docs/') return 1;
    return left.title.localeCompare(right.title);
  });
};
