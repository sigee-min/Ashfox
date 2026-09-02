const fs = require('node:fs');
const path = require('node:path');

const { outdir, webRoot } = require('./buildOptions');

const repoRoot = path.resolve(webRoot, '..', '..');
const brandSource = path.join(repoRoot, 'assets', 'brand');
const staticFiles = [
  'workbench/agent-manifest.json',
  'workbench/index.html'
];
const copiedStaticFiles = ['workbench/index.html'];

const loadAgentManifest = () => {
  require('ts-node').register({
    transpileOnly: true,
    compilerOptions: {
      module: 'CommonJS',
      moduleResolution: 'Node'
    }
  });
  return require(
    '../src/features/agent/agentManifest'
  ).agentManifest;
};

const prepareOutput = ({ includeShowcaseTooling = false } = {}) => {
  fs.rmSync(outdir, { recursive: true, force: true });
  fs.mkdirSync(outdir, { recursive: true });
  for (const destination of copiedStaticFiles) {
    const target = path.join(outdir, destination);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(
      path.join(webRoot, path.basename(destination)),
      target
    );
  }
  const manifestTarget = path.join(
    outdir,
    'workbench',
    'agent-manifest.json'
  );
  fs.mkdirSync(path.dirname(manifestTarget), { recursive: true });
  fs.writeFileSync(
    manifestTarget,
    `${JSON.stringify(loadAgentManifest())}\n`
  );
  fs.cpSync(brandSource, path.join(outdir, 'brand'), {
    recursive: true
  });
  if (includeShowcaseTooling) {
    const toolingRoot = path.join(outdir, 'tooling');
    fs.mkdirSync(toolingRoot, { recursive: true });
    fs.copyFileSync(
      path.join(repoRoot, 'examples', 'shared-creatures.ashfoxworkspace'),
      path.join(toolingRoot, 'shared-creatures.ashfoxworkspace')
    );
  }
};

module.exports = { prepareOutput, staticFiles };
