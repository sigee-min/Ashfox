process.env.DISABLE_V8_COMPILE_CACHE =
  process.env.DISABLE_V8_COMPILE_CACHE || '1';

const path = require('path');
const { register } = require('ts-node');
const {
  discoverTests,
  requireTests,
  selectTests
} = require('../../../scripts/tests/discovery');

register({
  transpileOnly: true,
  compilerOptions: {
    module: 'CommonJS',
    moduleResolution: 'Node'
  }
});

const tests = discoverTests(__dirname);

void (async () => {
  for (const module of requireTests(selectTests(tests, { label: 'web tests' }))) {
    if (module.test instanceof Promise) await module.test;
  }
  console.log('web state tests ok');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
