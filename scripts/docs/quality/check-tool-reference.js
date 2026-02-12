/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { docsRoot, listDocFiles, locales, toPosixPath } = require('./shared');

const localeRules = {
  en: {
    required: [
      '## Overview',
      '## Tool Description',
      '## Input Schema (JSON)',
      '## Field Reference',
      '## Minimal Request Example',
      '## Response Example',
      '## Operational Notes',
    ],
    forbidden: [
      /^## 도구 설명$/m,
      /^## 입력 스키마 \(JSON\)$/m,
      /^## 필드 레퍼런스$/m,
    ],
  },
  ko: {
    required: [
      '## 개요',
      '## 도구 설명',
      '## 입력 스키마 (JSON)',
      '## 필드 레퍼런스',
      '## 최소 요청 예시',
      '## 응답 예시',
      '## 운영 노트',
    ],
    forbidden: [
      /^## Tool Description$/m,
      /^## Input Schema \(JSON\)$/m,
      /^## Field Reference$/m,
      /\| Field \| Type \| 필수 \| Description \| Constraints \|/,
      /^Validates the current project\.$/m,
    ],
  },
};

function isToolReferenceLeaf(locale, filePath) {
  const localeRoot = path.join(docsRoot, locale);
  const rel = toPosixPath(path.relative(localeRoot, filePath));
  if (!rel.startsWith('users/tool-reference/')) return false;
  const basename = path.basename(rel).toLowerCase();
  if (basename === 'index.mdx' || basename === 'index.md') return false;
  return rel.split('/').length >= 4;
}

function checkToolReference() {
  const violations = [];

  for (const locale of locales) {
    const files = listDocFiles(locale).filter((filePath) => isToolReferenceLeaf(locale, filePath));
    const rules = localeRules[locale];
    if (!rules) continue;

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = toPosixPath(path.relative(process.cwd(), filePath));

      for (const requiredText of rules.required) {
        if (!content.includes(requiredText)) {
          violations.push(`${relativePath}: missing required section/text "${requiredText}"`);
        }
      }

      for (const forbiddenPattern of rules.forbidden) {
        if (forbiddenPattern.test(content)) {
          violations.push(`${relativePath}: contains locale-mixed template text matching ${forbiddenPattern}`);
        }
      }

      if (locale === 'ko') {
        const hasFieldTable = content.includes('| Field | Type | 필수 | 설명 | 제약 |');
        const hasNoFieldsText = content.includes('입력 필드가 없습니다.');
        if (!hasFieldTable && !hasNoFieldsText) {
          violations.push(
            `${relativePath}: field reference must include either localized table header or "입력 필드가 없습니다."`
          );
        }
      }
    }
  }

  return violations;
}

module.exports = {
  checkToolReference,
};
