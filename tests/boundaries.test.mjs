import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkBoundaries } from '../scripts/check-boundaries.mjs';

function fixture(t) {
  const temporaryRoot = resolve('.sites-runtime/test-fixtures');
  mkdirSync(temporaryRoot, { recursive: true });
  const root = mkdtempSync(resolve(temporaryRoot, 'boundaries-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const area of ['packages/contracts', 'apps/dashboard', 'apps/api']) {
    mkdirSync(resolve(root, area, 'src'), { recursive: true });
    writeFileSync(
      resolve(root, area, 'package.json'),
      JSON.stringify({
        dependencies:
          area === 'packages/contracts'
            ? { zod: '4.6.7' }
            : { '@cloudlane/contracts': '0.1.0' },
      }),
    );
    writeFileSync(
      resolve(root, area, 'src/index.ts'),
      'export const value = 1;\n',
    );
  }
  return root;
}
test('boundaries allow a portable contract and separate consumers', (t) =>
  assert.deepEqual(checkBoundaries(fixture(t)), []));
test('boundaries reject a browser import of API implementation or agent contract', (t) => {
  const root = fixture(t);
  writeFileSync(
    resolve(root, 'apps/dashboard/src/index.ts'),
    "import '../../api/src/main.ts';\nimport '@cloudlane/contracts/agent';\n",
  );
  assert.equal(checkBoundaries(root).length, 2);
});
test('boundaries reject Node-only contract imports and direct API host execution', (t) => {
  const root = fixture(t);
  writeFileSync(
    resolve(root, 'packages/contracts/src/index.ts'),
    "import { readFile } from 'node:fs';\n",
  );
  writeFileSync(
    resolve(root, 'apps/api/src/index.ts'),
    "import { execFile } from 'node:child_process';\nexecFile('docker');\n",
  );
  const errors = checkBoundaries(root);
  assert.ok(errors.some((value) => value.includes('contracts cannot import')));
  assert.ok(errors.some((value) => value.includes('API cannot import')));
  assert.ok(errors.some((value) => value.includes('direct process')));
});
