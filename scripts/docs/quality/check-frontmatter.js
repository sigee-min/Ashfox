/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { listDocFiles, locales, parseFrontmatter, hasFrontmatterKey, toPosixPath } = require('./shared');

function checkFrontmatter() {
  const violations = [];

  for (const locale of locales) {
    const files = listDocFiles(locale);
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf8');
      const frontmatter = parseFrontmatter(content);
      const relative = toPosixPath(path.relative(process.cwd(), filePath));

      if (!frontmatter) {
        violations.push(`${relative}: missing valid frontmatter block`);
        continue;
      }

      if (!hasFrontmatterKey(frontmatter.values, 'title')) {
        violations.push(`${relative}: missing frontmatter key "title"`);
      }

      if (!hasFrontmatterKey(frontmatter.values, 'description')) {
        violations.push(`${relative}: missing frontmatter key "description"`);
      }
    }
  }

  return violations;
}

module.exports = {
  checkFrontmatter,
};
