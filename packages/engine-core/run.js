process.env.DISABLE_V8_COMPILE_CACHE = process.env.DISABLE_V8_COMPILE_CACHE || '1';

const fs = require('fs');
const path = require('path');
const { register } = require('ts-node');

register({
  transpileOnly: true,
  compilerOptions: {
    module: 'CommonJS'
  }
});

const testsDir = path.join(__dirname, 'tests');
const tests = fs
  .readdirSync(testsDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b));

globalThis.__ashfoxEngineTestPromises = [];

const main = async () => {
  for (const test of tests) {
    require(path.join(testsDir, test));
  }
  await Promise.all(globalThis.__ashfoxEngineTestPromises);
  console.log('engine-core tests ok');
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
