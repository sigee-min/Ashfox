const esbuild = require('esbuild');

const { createBuildOptions } = require('./buildOptions');
const { prepareOutput } = require('./prepareOutput');

prepareOutput();

esbuild
  .build(createBuildOptions({ minify: true, sourcemap: true }))
  .then(() => {
    console.log('web static build ok');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
