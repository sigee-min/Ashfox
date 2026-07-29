process.env.DISABLE_V8_COMPILE_CACHE =
  process.env.DISABLE_V8_COMPILE_CACHE || '1';

const fs = require('fs');
const path = require('path');
const { register } = require('ts-node');

register({
  transpileOnly: true,
  compilerOptions: {
    module: 'CommonJS',
    moduleResolution: 'Node'
  }
});

const tests = fs
  .readdirSync(__dirname, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right));

void (async () => {
  for (const test of tests) {
    const module = require(path.join(__dirname, test));
    if (module.test instanceof Promise) await module.test;
  }
  console.log('web state tests ok');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
