const esbuild = require('esbuild');

const { createBuildOptions, outdir } = require('./buildOptions');
const { prepareOutput } = require('./prepareOutput');

const run = async () => {
  prepareOutput({ includeShowcaseTooling: true });
  const requestedPort = Number.parseInt(
    process.env.ASHFOX_WEB_PORT ?? '3000',
    10
  );
  if (!Number.isInteger(requestedPort) || requestedPort < 1024 || requestedPort > 65_535) {
    throw new Error('ASHFOX_WEB_PORT must be an available port from 1024 to 65535.');
  }
  const context = await esbuild.context(
    createBuildOptions({ minify: false, sourcemap: 'inline' })
  );
  await context.watch();
  const server = await context.serve({
    host: '127.0.0.1',
    port: requestedPort,
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
