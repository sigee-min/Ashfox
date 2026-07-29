const esbuild = require('esbuild');

const { createBuildOptions, outdir } = require('./buildOptions');
const { prepareOutput } = require('./prepareOutput');

const run = async () => {
  prepareOutput();
  const context = await esbuild.context(
    createBuildOptions({ minify: false, sourcemap: 'inline' })
  );
  await context.watch();
  const server = await context.serve({
    host: '127.0.0.1',
    port: 3000,
    servedir: outdir
  });

  console.log(`ashfox workbench: http://127.0.0.1:${server.port}/workbench/`);

  const stop = async () => {
    await context.dispose();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void stop();
  });
  process.on('SIGTERM', () => {
    void stop();
  });
};

void run().catch((error) => {
  console.error(error);
  process.exit(1);
});
