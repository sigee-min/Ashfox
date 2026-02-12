/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const {
  extractLinks,
  isExternalTarget,
  listDocFiles,
  locales,
  normalizeLinkTarget,
  toPosixPath,
} = require('./shared');

function checkLinkLocale() {
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

        const docsLocaleMatch = normalized.match(/^\/(en|ko)\/docs(?:\/|$)/);
        if (!docsLocaleMatch) continue;

        const linkedLocale = docsLocaleMatch[1];
        if (linkedLocale !== locale) {
          violations.push(
            `${relativePath}:${link.line} -> cross-locale docs link (${linkedLocale}) used inside ${locale} doc: ${normalized}`
          );
        }
      }
    }
  }

  return violations;
}

module.exports = {
  checkLinkLocale,
};
