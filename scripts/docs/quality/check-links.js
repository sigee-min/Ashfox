/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const {
  extractLinks,
  isExternalTarget,
  listDocFiles,
  locales,
  normalizeLinkTarget,
  resolveAbsoluteDocsUrl,
  resolveRelativeDocsUrl,
  toPosixPath,
} = require('./shared');

function isDocsAbsolutePath(target) {
  return /^\/(en|ko)\/docs(?:\/|$)/.test(target);
}

function checkLinks() {
  const violations = [];

  for (const locale of locales) {
    const files = listDocFiles(locale);

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf8');
      const links = extractLinks(content);
      const relativePath = toPosixPath(path.relative(process.cwd(), filePath));

      for (const link of links) {
        const normalized = normalizeLinkTarget(link.target);
        if (!normalized || normalized.startsWith('#')) continue;
        if (normalized.includes('{') || normalized.includes('}')) continue;
        if (isExternalTarget(normalized)) continue;

        if (normalized.startsWith('/')) {
          if (!isDocsAbsolutePath(normalized)) continue;

          const resolved = resolveAbsoluteDocsUrl(normalized);
          if (!resolved) {
            violations.push(`${relativePath}:${link.line} -> broken docs link: ${normalized}`);
          }
          continue;
        }

        const resolvedRelative = resolveRelativeDocsUrl(filePath, normalized);
        if (!resolvedRelative) {
          violations.push(`${relativePath}:${link.line} -> broken relative link: ${normalized}`);
        }
      }
    }
  }

  return violations;
}

module.exports = {
  checkLinks,
};
