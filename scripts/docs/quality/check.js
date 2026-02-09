/* eslint-disable no-console */
const { checkFrontmatter } = require('./check-frontmatter');
const { checkLinks } = require('./check-links');
const { checkLocalePairs } = require('./check-locale-pairs');

function reportViolations(title, violations) {
  if (violations.length === 0) {
    console.log(`${title}: ok`);
    return 0;
  }

  console.error(`${title}: failed (${violations.length})`);
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  return violations.length;
}

function main() {
  const frontmatterViolations = checkFrontmatter();
  const linkViolations = checkLinks();
  const localePairViolations = checkLocalePairs();

  let totalViolations = 0;
  totalViolations += reportViolations('docs frontmatter check', frontmatterViolations);
  totalViolations += reportViolations('docs link check', linkViolations);
  totalViolations += reportViolations('docs locale pair check', localePairViolations);

  if (totalViolations > 0) {
    throw new Error(`docs quality gate failed with ${totalViolations} violation(s)`);
  }

  console.log('docs quality gate ok');
}

main();
