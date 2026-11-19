import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { assertDisposableDatabase } from '../scripts/run-postgres-tests.mjs';
import { validateWorkflow } from '../scripts/validate-ci.mjs';

test('database tests refuse absent opt-in, non-loopback hosts and non-disposable database names', () => {
  const valid = {
    CLOUDLANE_POSTGRES_TESTS: '1',
    CLOUDLANE_TEST_DATABASE_URL:
      'postgres://test:test-only@127.0.0.1/cloudlane_ci',
  };
  assert.doesNotThrow(() => assertDisposableDatabase(valid));
  for (const env of [
    {},
    { ...valid, CLOUDLANE_POSTGRES_TESTS: '0' },
    {
      ...valid,
      CLOUDLANE_TEST_DATABASE_URL:
        'postgres://test:test-only@127.0.0.1/cloudlane',
    },
    {
      ...valid,
      CLOUDLANE_TEST_DATABASE_URL:
        'postgres://test:test-only@db.example.com/cloudlane_ci',
    },
    {
      ...valid,
      CLOUDLANE_TEST_DATABASE_URL:
        valid.CLOUDLANE_TEST_DATABASE_URL + '?options=unsafe',
    },
  ])
    assert.throws(
      () => assertDisposableDatabase(env),
      (error) => !error.message.includes('test-only'),
    );
});
test('CI rejects a missing, unpinned, optional or disconnected PostgreSQL test gate', () => {
  const source = readFileSync('.github/workflows/ci.yml', 'utf8');
  for (const mutate of [
    (w) => delete w.jobs.postgres,
    (w) => (w.jobs.postgres.services.postgres.image = 'postgres:latest'),
    (w) => (w.jobs.required.needs = ['progress', 'verify', 'e2e']),
    (w) => (w.jobs.postgres.if = '${{ false }}'),
    (w) =>
      (w.jobs.postgres.steps.find((s) =>
        s.run?.includes('npm run test:postgres'),
      ).if = '${{ false }}'),
    (w) =>
      (w.jobs.postgres.steps.find((s) =>
        s.run?.includes('npm run test:postgres'),
      ).run = 'echo skipped'),
  ]) {
    const workflow = parse(source);
    mutate(workflow);
    assert.ok(validateWorkflow(stringify(workflow)).length > 0);
  }
});
