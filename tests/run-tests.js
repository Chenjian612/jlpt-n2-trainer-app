const fs = require('node:fs');
const path = require('node:path');

const testsDir = __dirname;
const files = fs
  .readdirSync(testsDir)
  .filter((file) => file.endsWith('.test.js'))
  .sort();

let failures = 0;
let total = 0;

for (const file of files) {
  const suite = require(path.join(testsDir, file));
  const suiteName = suite.name || file;

  for (const entry of suite.tests || []) {
    total += 1;
    try {
      entry.run();
      console.log(`PASS ${suiteName} :: ${entry.name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${suiteName} :: ${entry.name}`);
      console.error(error.stack || error.message || String(error));
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures}/${total} tests failed.`);
  process.exit(1);
}

console.log(`\nAll ${total} tests passed.`);
