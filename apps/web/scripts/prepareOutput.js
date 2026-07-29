const fs = require('node:fs');
const path = require('node:path');

const { outdir, webRoot } = require('./buildOptions');

const prepareOutput = () => {
  fs.rmSync(outdir, { recursive: true, force: true });
  fs.mkdirSync(outdir, { recursive: true });
  fs.copyFileSync(
    path.join(webRoot, 'index.html'),
    path.join(outdir, 'index.html')
  );
};

module.exports = { prepareOutput };
