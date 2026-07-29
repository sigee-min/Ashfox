const path = require('node:path');

const webRoot = path.resolve(__dirname, '..');
const outdir = path.join(webRoot, 'dist');

const createBuildOptions = ({ minify, sourcemap }) => ({
  entryPoints: {
    app: path.join(webRoot, 'src', 'main.tsx')
  },
  outdir,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  jsx: 'automatic',
  minify,
  sourcemap,
  entryNames: 'assets/[name]',
  chunkNames: 'assets/[name]-[hash]',
  assetNames: 'assets/[name]-[hash]',
  define: {
    'process.env.NODE_ENV': JSON.stringify(
      minify ? 'production' : 'development'
    )
  },
  logLevel: 'info'
});

module.exports = {
  createBuildOptions,
  outdir,
  webRoot
};
