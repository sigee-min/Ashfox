/* eslint-disable no-console */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {
  readDevelopmentManifest
} = require('./manifest');
const {
  repositoryPolicyViolations
} = require('./repositoryPolicyGate');
const {
  assertSourcePatternRegistryMatches,
  sourcePatternFindings
} = require('./patterns');

const repoRoot = path.resolve(__dirname, '..', '..');
const developmentManifest = readDevelopmentManifest(repoRoot);

const readText = (filePath) => fs.readFileSync(filePath, 'utf8');

const walk = (directory, predicate) => {
  const files = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const value = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      files.push(...walk(value, predicate));
    } else if (predicate(value)) {
      files.push(value);
    }
  }
  return files;
};

const relativePath = (filePath) =>
  path.relative(repoRoot, filePath).replace(/\\/g, '/');

const workspaceSourceDirectories = () =>
  developmentManifest.architecture.workspaceSourceScopes.flatMap((scope) =>
    fs.readdirSync(path.join(repoRoot, scope), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => path.join(repoRoot, scope, entry.name))
      .filter((directory) =>
        fs.existsSync(path.join(directory, 'package.json')) &&
        fs.existsSync(path.join(directory, 'src'))
      )
      .map((directory) => path.join(directory, 'src'))
  );

const requiresSemicolon = (node) =>
  ts.isVariableStatement(node) ||
  ts.isExpressionStatement(node) ||
  ts.isReturnStatement(node) ||
  ts.isThrowStatement(node) ||
  ts.isBreakStatement(node) ||
  ts.isContinueStatement(node) ||
  ts.isImportDeclaration(node) ||
  ts.isImportEqualsDeclaration(node) ||
  ts.isExportDeclaration(node) ||
  ts.isExportAssignment(node) ||
  ts.isTypeAliasDeclaration(node) ||
  ts.isPropertyDeclaration(node);

const sourceStyleViolations = (filePath, source, style) => {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const findings = [];
  const indentedLines = new Set();
  const lines = source.split(/\r?\n/);
  const report = (node, rule) => {
    const line = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile)
    ).line + 1;
    findings.push({
      file: relativePath(filePath),
      line,
      rule,
      snippet: lines[line - 1].trim().slice(0, 200)
    });
  };
  const visit = (node) => {
    const start = node.getStart(sourceFile);
    const position = sourceFile.getLineAndCharacterOfPosition(start);
    const lineStart = sourceFile.getPositionOfLineAndCharacter(
      position.line,
      0
    );
    const indentation = source.slice(lineStart, start);
    if (!indentedLines.has(position.line) && /^\s*$/.test(indentation)) {
      indentedLines.add(position.line);
      if (
        indentation.includes('\t') ||
        position.character % style.indentSpaces !== 0
      ) {
        report(node, 'style-indentation');
      }
    }
    if (
      style.quotes === 'single' &&
      ts.isStringLiteral(node) &&
      !ts.isJsxAttribute(node.parent) &&
      source[start] === '"'
    ) {
      report(node, 'style-quotes');
    }
    if (
      style.semicolons === 'required' &&
      requiresSemicolon(node) &&
      !source.slice(start, node.end).trimEnd().endsWith(';')
    ) {
      report(node, 'style-semicolons');
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
};

const main = () => {
  const repositoryViolations = repositoryPolicyViolations(
    repoRoot,
    developmentManifest.architecture
  );
  if (repositoryViolations.length > 0) {
    throw new Error(repositoryViolations[0]);
  }

  const sourcePolicies = developmentManifest.quality.forbiddenSourcePatterns;
  assertSourcePatternRegistryMatches(sourcePolicies);
  const sourceDirectories = workspaceSourceDirectories();
  const sourceFiles = sourceDirectories.flatMap((directory) =>
    walk(directory, (filePath) =>
      filePath.endsWith('.ts') || filePath.endsWith('.tsx')
    )
  );

  const findings = [];
  for (const filePath of sourceFiles) {
    const source = readText(filePath);
    findings.push(...sourcePatternFindings(
      filePath,
      relativePath(filePath),
      source,
      sourcePolicies
    ));
    findings.push(...sourceStyleViolations(
      filePath,
      source,
      developmentManifest.engineering.style
    ));
  }

  if (findings.length > 0) {
    console.error('ashfox quality gate failed. Violations:');
    for (const finding of findings) {
      console.error(
        `- ${finding.rule}: ${finding.file}:${finding.line} :: ` +
        finding.snippet
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log('ashfox quality gate ok');
};

if (require.main === module) main();

module.exports = { sourceStyleViolations };
