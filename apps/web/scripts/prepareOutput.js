const fs = require('node:fs');
const path = require('node:path');

const { outdir, webRoot } = require('./buildOptions');

const repoRoot = path.resolve(webRoot, '..', '..');
const brandSource = path.join(repoRoot, 'assets', 'brand');
const staticFiles = [
  'workbench/agent-manifest.json',
  'workbench/index.html'
];

const prepareOutput = () => {
  fs.rmSync(outdir, { recursive: true, force: true });
  fs.mkdirSync(outdir, { recursive: true });
  for (const destination of staticFiles) {
    const target = path.join(outdir, destination);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(
      path.join(webRoot, path.basename(destination)),
      target
    );
  }
  fs.cpSync(brandSource, path.join(outdir, 'brand'), {
    recursive: true
  });
};

module.exports = { prepareOutput, staticFiles };
