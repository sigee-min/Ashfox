/* eslint-disable no-console */
const { listDocFiles, loadPairIgnorePatterns, locales, routeFromFile, isIgnoredByPatterns } = require('./shared');

function collectRoutes(locale) {
  const files = listDocFiles(locale);
  const routes = new Set();

  for (const filePath of files) {
    routes.add(routeFromFile(locale, filePath));
  }

  return routes;
}

function checkLocalePairs() {
  const violations = [];
  const ignorePatterns = loadPairIgnorePatterns();
  const [leftLocale, rightLocale] = locales;

  const leftRoutes = collectRoutes(leftLocale);
  const rightRoutes = collectRoutes(rightLocale);

  for (const route of leftRoutes) {
    if (isIgnoredByPatterns(route, ignorePatterns)) continue;
    if (!rightRoutes.has(route)) {
      violations.push(`${leftLocale} -> ${rightLocale} missing pair: ${route || '[root]'}`);
    }
  }

  for (const route of rightRoutes) {
    if (isIgnoredByPatterns(route, ignorePatterns)) continue;
    if (!leftRoutes.has(route)) {
      violations.push(`${rightLocale} -> ${leftLocale} missing pair: ${route || '[root]'}`);
    }
  }

  return violations;
}

module.exports = {
  checkLocalePairs,
};
