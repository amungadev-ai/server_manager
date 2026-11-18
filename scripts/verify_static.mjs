import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const mode = process.argv[2];
assert.ok(
  ['http', 'demo'].includes(mode),
  'Use: node scripts/verify_static.mjs http|demo',
);
const output = resolve('dist');
assert.ok(
  existsSync(join(output, 'index.html')),
  'The SPA fallback must exist.',
);
assert.ok(
  !existsSync(join(output, 'server')),
  'Static output must not require an SSR server.',
);
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
const paths = files(output);
const javascript = paths
  .filter((path) => path.endsWith('.js'))
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');
const fixturesIncluded = javascript.includes('maid-finder.example');
assert.ok(
  !javascript.includes('Test Fixture Project') &&
    !javascript.includes('test-owner@example.test'),
  'CI-only fixture data must never ship in the dashboard.',
);
assert.ok(
  !javascript.includes('release.startCandidate'),
  'Agent contracts must not be bundled into the dashboard.',
);
assert.equal(
  fixturesIncluded,
  mode === 'demo',
  'Production must omit synthetic infrastructure fixtures.',
);
console.log(
  JSON.stringify({
    status: 'PASS',
    mode,
    staticFiles: paths.length,
    totalBytes: paths.reduce((sum, path) => sum + statSync(path).size, 0),
    fixturesIncluded,
  }),
);
