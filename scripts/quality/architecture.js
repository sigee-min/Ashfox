/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '..', '..');
const sourceRoots = [
  path.join(repoRoot, 'packages', 'engine-core', 'src'),
  path.join(repoRoot, 'apps', 'web', 'src')
];
const maxFileLines = 600;
const maxFunctionLines = 200;

const sourceFiles = (root) => {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const value = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(value);
      else if (/\.tsx?$/.test(value)) files.push(value);
    }
  };
  visit(root);
  return files;
};

const relativePath = (file) =>
  path.relative(repoRoot, file).replace(/\\/g, '/');

const lineCount = (source) => source.split(/\r?\n/).length;

const functionName = (node, sourceFile) => {
  if (node.name) return node.name.getText(sourceFile);
  if (
    node.parent &&
    ts.isVariableDeclaration(node.parent) &&
    node.parent.name
  ) {
    return node.parent.name.getText(sourceFile);
  }
  return '<anonymous>';
};

const oversizedFunctions = (file, source) => {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const findings = [];
  const visit = (node) => {
    if (ts.isFunctionLike(node) && node.body) {
      const start =
        sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
          .line + 1;
      const end =
        sourceFile.getLineAndCharacterOfPosition(node.end).line + 1;
      if (end - start + 1 > maxFunctionLines) {
        findings.push({
          file: relativePath(file),
          name: functionName(node, sourceFile),
          start,
          lines: end - start + 1
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
};

const importSpecifiers = (source) => {
  const values = [];
  const pattern =
    /(?:\bfrom\s+|\bimport\s*(?:\(\s*)?)['"]([^'"]+)['"]/g;
  let match;
  while ((match = pattern.exec(source)) !== null) values.push(match[1]);
  return values;
};

const resolveImport = (fromFile, specifier, knownFiles) => {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  return [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx')
  ].find((candidate) => knownFiles.has(candidate)) ?? null;
};

const dependencyGraph = (files, sources) => {
  const knownFiles = new Set(files);
  return new Map(files.map((file) => [
    file,
    importSpecifiers(sources.get(file))
      .map((specifier) => resolveImport(file, specifier, knownFiles))
      .filter((target) => target !== null)
  ]));
};

const dependencyCycles = (graph) => {
  let nextIndex = 0;
  const indexes = new Map();
  const lowLinks = new Map();
  const stack = [];
  const stacked = new Set();
  const cycles = [];
  const visit = (file) => {
    indexes.set(file, nextIndex);
    lowLinks.set(file, nextIndex);
    nextIndex += 1;
    stack.push(file);
    stacked.add(file);
    for (const target of graph.get(file)) {
      if (!indexes.has(target)) {
        visit(target);
        lowLinks.set(file, Math.min(lowLinks.get(file), lowLinks.get(target)));
      } else if (stacked.has(target)) {
        lowLinks.set(file, Math.min(lowLinks.get(file), indexes.get(target)));
      }
    }
    if (lowLinks.get(file) !== indexes.get(file)) return;
    const component = [];
    let current;
    do {
      current = stack.pop();
      stacked.delete(current);
      component.push(current);
    } while (current !== file);
    if (component.length > 1) cycles.push(component);
  };
  for (const file of graph.keys()) {
    if (!indexes.has(file)) visit(file);
  }
  return cycles;
};

const main = () => {
  const files = sourceRoots.flatMap(sourceFiles);
  const sources = new Map(
    files.map((file) => [file, fs.readFileSync(file, 'utf8')])
  );
  const oversizedFiles = files
    .map((file) => ({
      file: relativePath(file),
      lines: lineCount(sources.get(file))
    }))
    .filter(({ lines }) => lines > maxFileLines);
  const oversized = files.flatMap((file) =>
    oversizedFunctions(file, sources.get(file))
  );
  const cycles = dependencyCycles(dependencyGraph(files, sources));
  if (
    oversizedFiles.length === 0 &&
    oversized.length === 0 &&
    cycles.length === 0
  ) {
    console.log(
      `ashfox architecture gate ok: files <= ${maxFileLines}, ` +
      `functions <= ${maxFunctionLines}, cycles 0`
    );
    return;
  }
  for (const finding of oversizedFiles) {
    console.error(
      `architecture: file ${finding.file} has ${finding.lines} lines ` +
      `(max ${maxFileLines})`
    );
  }
  for (const finding of oversized) {
    console.error(
      `architecture: function ${finding.file}:${finding.start} ` +
      `${finding.name} has ${finding.lines} lines ` +
      `(max ${maxFunctionLines})`
    );
  }
  for (const cycle of cycles) {
    console.error(
      'architecture: dependency cycle ' +
      cycle.map(relativePath).join(' -> ')
    );
  }
  process.exitCode = 1;
};

main();
