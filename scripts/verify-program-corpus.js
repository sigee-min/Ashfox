'use strict';

/** Verify the checked-in portable workspace through the public authority path. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { register } = require('ts-node');

register({ transpileOnly: true, compilerOptions: { module: 'CommonJS' } });

const {
  ASHFOX_WORKSPACE_FILE_EXTENSION,
  evaluateProductionReadiness,
  openAssetProject,
  readWorkspaceFile,
  validateProjectDocument,
  writeWorkspaceFile
} = require('../packages/engine-core/src');

const ROOT = path.resolve(__dirname, '..');
const EXAMPLES_ROOT = path.join(ROOT, 'examples');
const WORKSPACE_PATH = path.join(
  EXAMPLES_ROOT,
  `shared-creatures${ASHFOX_WORKSPACE_FILE_EXTENSION}`
);
const ENTRY_NAMES = Object.freeze(['fox', 'goblin']);
const MODULE_PATHS = Object.freeze([
  'body.ashfox',
  'goblin-body.ashfox',
  'goblin-rig.ashfox',
  'goblin-surface.ashfox',
  'rig.ashfox',
  'surface.ashfox'
]);
const CREATED_AT = '2026-01-01T00:00:00.000Z';

const compileEntry = (workspace, entryName) => {
  const opened = openAssetProject({
    workspace,
    entry: { packageName: 'creatures', entryName },
    identity: {
      id: `example-${entryName}`,
      revision: 'example-0001',
      createdAt: CREATED_AT
    }
  });
  assert.equal(opened.ok, true, opened.ok ? '' : opened.diagnostics
    .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`).join(' | '));
  if (!opened.ok) throw new TypeError(`${entryName} did not open.`);
  const report = validateProjectDocument(opened.project.document);
  assert.equal(report.valid, true, `${entryName}: canonical product is invalid.`);
  const readiness = evaluateProductionReadiness(opened.project.document, report);
  assert.equal(readiness.mechanicallyReady, true,
    `${entryName}: product is not mechanically ready.`);
  assert.equal(opened.project.document.name, entryName);
  assert.ok(Object.keys(opened.project.document.scene.nodes).length > 0);
  assert.ok(Object.keys(opened.project.document.textures).length > 0);
  assert.ok(Object.keys(opened.project.document.animations).length > 0);
  return opened.project;
};

const verifyCorpus = () => {
  const exampleFiles = fs.readdirSync(EXAMPLES_ROOT, { withFileTypes: true });
  assert.deepEqual(exampleFiles.map((entry) => entry.name), [
    `shared-creatures${ASHFOX_WORKSPACE_FILE_EXTENSION}`
  ], 'examples must expose one portable workspace and no legacy source tree');
  assert.equal(exampleFiles[0].isFile(), true);

  const source = fs.readFileSync(WORKSPACE_PATH, 'utf8');
  const read = readWorkspaceFile(source);
  assert.equal(read.ok, true, read.ok ? '' : read.diagnostics
    .map((diagnostic) => diagnostic.message).join(' | '));
  if (!read.ok) throw new TypeError('Example workspace could not be read.');
  const written = writeWorkspaceFile(read.workspace);
  assert.deepEqual(written, { ok: true, source },
    'example workspace must already use the canonical byte encoding');

  const pkg = read.workspace.manifest.packages[0];
  assert.ok(pkg);
  assert.equal(pkg.name, 'creatures');
  assert.deepEqual(pkg.manifest.entries.map((entry) => entry.name), ENTRY_NAMES);
  assert.deepEqual(pkg.manifest.modules.map((module) => module.path), MODULE_PATHS);

  const projects = ENTRY_NAMES.map((entryName) =>
    compileEntry(read.workspace, entryName));
  assert.notEqual(projects[0].build.closureHash, projects[1].build.closureHash,
    'each selected root must retain its own exact transitive closure identity');
  assert.equal(projects.every((project) =>
    project.build.workspaceHash === projects[0].build.workspaceHash), true,
  'entries in one workspace must share one atomic workspace authority');

  const nodes = projects.reduce((count, project) =>
    count + Object.keys(project.document.scene.nodes).length, 0);
  console.log(`asset workspace verified: ${projects.length} entries, ` +
    `${read.workspace.files.length} source modules, ${nodes} scene nodes`);
  return projects;
};

if (require.main === module) verifyCorpus();

module.exports = Object.freeze({ verifyCorpus });
