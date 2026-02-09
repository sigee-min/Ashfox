const { spawnSync } = require('child_process');
const path = require('path');

const tests = [
  'schemaPolicy.test.ts',
  'toolSchemasCoverage.test.ts',
  'schemaValidation.test.ts',
  'exportSchemaContracts.test.ts'
];

const run = (filter) => {
  console.log(`[practical] ${filter}`);
  const result = spawnSync(process.execPath, [path.join(__dirname, 'run.js')], {
    stdio: 'inherit',
    env: { ...process.env, ASHFOX_TEST_FILTER: filter }
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

for (const filter of tests) {
  run(filter);
}

console.log('conformance practical tests ok');

