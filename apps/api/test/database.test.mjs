import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { databaseConfig } = require('../dist/database/config.js');
const { PlatformDatabase } = require('../dist/database/database.js');
const {
  migrate,
  validateHistory,
  migrationChecksum,
  loadMigrations,
} = require('../dist/database/migrations.js');

test('database configuration has no ambient defaults, remote hosts or URL overrides', () => {
  assert.equal(databaseConfig(undefined), null);
  const valid = databaseConfig(
    'postgresql://unit:unit-only@127.0.0.1/cloudlane',
  );
  assert.equal(valid.max, 4);
  assert.ok(valid.connectionTimeoutMillis > 0);
  for (const value of [
    '',
    'not-a-url',
    'mysql://unit:unit-only@localhost/cloudlane',
    'postgres://unit:unit-only@db.example.com/cloudlane',
    'postgres://localhost/cloudlane',
    'postgres://unit:unit-only@localhost/',
    'postgres://unit:unit-only@localhost/cloudlane?options=-csearch_path=evil',
    'postgres://unit:unit-only@localhost/cloudlane?sslmode=no-verify',
  ])
    assert.throws(
      () => databaseConfig(value),
      (error) => !error.message.includes('unit-only'),
    );
});
test('an unconfigured database does not connect using PG environment fallbacks', async () => {
  const db = new PlatformDatabase();
  assert.equal(await db.status(), 'unconfigured');
  await db.onApplicationShutdown();
});
test('an unreachable database returns only a coarse unavailable state', async () => {
  const db = new PlatformDatabase(
    'postgresql://unit:private-driver-details@127.0.0.1:1/cloudlane',
  );
  try {
    assert.equal(await db.status(), 'unavailable');
  } finally {
    await db.onApplicationShutdown();
  }
});
test('migration history rejects altered, unknown, duplicate and non-prefix releases', () => {
  const source = loadMigrations();
  const applied = source.map((m) => ({
    id: m.id,
    checksum: migrationChecksum(m.sql),
  }));
  assert.doesNotThrow(() => validateHistory(source, applied));
  for (const [migrations, history] of [
    [source, [{ ...applied[0], checksum: '0'.repeat(64) }]],
    [source, [{ ...applied[0], id: '0002_unknown' }]],
    [source, [...applied, { id: '0002_future', checksum: 'a'.repeat(64) }]],
    [[...source, ...source], []],
    [[{ id: '../invalid', sql: 'SELECT 1' }], []],
    [[{ id: '0001_empty', sql: ' ' }], []],
  ])
    assert.throws(() => validateHistory(migrations, history));
});
test('failed rollback discards the client exactly once and redacts driver errors', async () => {
  const released = [];
  const pool = {
    async connect() {
      return {
        async query(sql) {
          if (sql === 'ROLLBACK' || sql.startsWith('SELECT pg_advisory'))
            throw new Error('private-driver-credential');
          return { rows: [] };
        },
        release(discard) {
          released.push(discard);
        },
      };
    },
  };
  await assert.rejects(
    migrate(pool, []),
    (error) => !error.message.includes('private-driver'),
  );
  assert.deepEqual(released, [true]);
});
test('connection and commit-acknowledgement failures are redacted without promising rollback', async () => {
  await assert.rejects(
    migrate(
      {
        async connect() {
          throw new Error('private-connection-detail');
        },
      },
      [],
    ),
    (error) => !error.message.includes('private-connection-detail'),
  );
  const pool = {
    async connect() {
      return {
        async query(sql) {
          if (sql === 'COMMIT') throw new Error('private-commit-detail');
          return { rows: [] };
        },
        release() {},
      };
    },
  };
  await assert.rejects(
    migrate(pool, []),
    (error) =>
      !error.message.includes('private-commit-detail') &&
      !error.message.includes('no changes committed') &&
      error.message.includes('verify the ledger'),
  );
});
test('migration CLI rejects arbitrary paths/arguments and never prints configured secrets', () => {
  for (const args of [[], ['../../arbitrary.sql']]) {
    const result = spawnSync(
      process.execPath,
      ['apps/api/dist/database/migrate-cli.js', ...args],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          CLOUDLANE_DATABASE_URL: 'invalid-private-url-value',
        },
      },
    );
    assert.equal(result.status, 1);
    assert.ok(
      !`${result.stdout}${result.stderr}`.includes('invalid-private-url-value'),
    );
    assert.match(result.stderr, /redacted/);
  }
});
