import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { createHarnessServers } from './e2e/server.mjs';

test('loopback harness separates static/demo, typed HTTP fixtures and the real unconfigured API', async (t) => {
  const parent = resolve('.sites-runtime/test-fixtures');
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(resolve(parent, 'http-harness-'));
  mkdirSync(resolve(root, 'outside'));
  writeFileSync(
    resolve(root, 'outside/private.txt'),
    'Synthetic outside-root fixture',
  );
  for (const mode of ['demo', 'http']) {
    mkdirSync(resolve(root, mode));
    writeFileSync(
      resolve(root, mode, 'index.html'),
      `<html>${mode} static fixture</html>`,
    );
  }
  const harness = await createHarnessServers({
    demoRoot: resolve(root, 'demo'),
    httpRoot: resolve(root, 'http'),
  });
  t.after(async () => {
    await harness.stop();
    rmSync(root, { recursive: true, force: true });
  });
  assert.match(
    await (await fetch(`${harness.urls.demo}/projects/deep-link`)).text(),
    /demo static fixture/,
  );
  const session = await fetch(`${harness.urls.fixture}/api/v1/auth/session`);
  assert.equal(session.headers.get('x-cloudlane-test-fixture'), '1');
  assert.equal(session.headers.get('set-cookie'), null);
  assert.equal((await session.json()).user.email, 'test-owner@example.test');
  const rejected = await fetch(`${harness.urls.fixture}/api/v1/auth/session`, {
    headers: { 'X-Cloudlane-Test-Scenario': 'unauthorized' },
  });
  assert.equal(rejected.status, 401);
  assert.equal((await rejected.json()).error.code, 'SESSION_REQUIRED');
  const mutation = await fetch(`${harness.urls.fixture}/api/v1/projects`, {
    method: 'POST',
  });
  assert.equal(mutation.status, 501);
  assert.equal(mutation.headers.get('set-cookie'), null);
  const actualSession = await fetch(
    `${harness.urls.unconfigured}/api/v1/auth/session`,
  );
  assert.equal(actualSession.status, 401);
  assert.equal((await actualSession.json()).error.code, 'SESSION_REQUIRED');
  const actualStatus = await fetch(
    `${harness.urls.unconfigured}/api/v1/installation/status`,
  );
  assert.deepEqual(await actualStatus.json(), {
    state: 'unconfigured',
    ownerConfigured: false,
    setupAvailable: false,
  });
  const unknown = await fetch(`${harness.urls.unconfigured}/api/v1/unknown`);
  assert.equal(unknown.status, 404);
  assert.match(unknown.headers.get('content-type'), /application\/json/);
  const traversal = await fetch(`${harness.urls.demo}/%2e%2e%2foutside`);
  assert.equal(traversal.status, 403);
  const crossOrigin = await fetch(
    `${harness.urls.fixture}/api/v1/auth/session`,
    { headers: { Origin: 'https://untrusted.example' } },
  );
  assert.equal(crossOrigin.status, 403);
  symlinkSync(resolve(root, 'outside'), resolve(root, 'demo/link'), 'dir');
  assert.equal(
    (await fetch(`${harness.urls.demo}/link/private.txt`)).status,
    403,
  );
});
