const fs = require('node:fs');
const path = require('node:path');

const { outdir, webRoot } = require('./buildOptions');

const staticFiles = [
  'agent-manifest.json',
  'index.html'
];

const prepareOutput = () => {
  fs.rmSync(outdir, { recursive: true, force: true });
  fs.mkdirSync(outdir, { recursive: true });
  for (const file of staticFiles) {
    fs.copyFileSync(
      path.join(webRoot, file),
      path.join(outdir, file)
    );
  }
};

module.exports = { prepareOutput, staticFiles };
