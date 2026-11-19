import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { assertDisposableDatabase } from '../../../../scripts/run-postgres-tests.mjs';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { Pool } = require('pg');
const { databaseConfig } = require('./dist/database/config.js');
const { migrate, loadMigrations } = require('./dist/database/migrations.js');
const { PlatformDatabase } = require('./dist/database/database.js');
const { createApp } = require('./dist/app.js');
assertDisposableDatabase(process.env);
const url = process.env.CLOUDLANE_TEST_DATABASE_URL;
const pool = new Pool(databaseConfig(url));
const identity = async () =>
  (await pool.query('SELECT id FROM cloudlane.installations')).rows[0].id;
const sqlCode = (code) => (error) => error.code === code;
async function seed() {
  const installationId = await identity(),
    userId = randomUUID(),
    workspaceId = randomUUID(),
    projectId = randomUUID();
  await pool.query(
    `INSERT INTO cloudlane.users (id, installation_id, email, display_name, password_hash) VALUES ($1, $2, 'test@example.test', 'Test owner', $3)`,
    [userId, installationId, 'nonfunctional-test-hash'.padEnd(64, '.')],
  );
  await pool.query(
    `INSERT INTO cloudlane.workspaces (id, installation_id, owner_user_id, name) VALUES ($1, $2, $3, 'Test workspace')`,
    [workspaceId, installationId, userId],
  );
  await pool.query(
    `INSERT INTO cloudlane.projects (id, workspace_id, name, slug) VALUES ($1, $2, 'Test project', 'test-project')`,
    [projectId, workspaceId],
  );
  return { installationId, userId, workspaceId, projectId };
}
before(async () => {
  const { rows } = await pool.query('SHOW server_version');
  writeFileSync(
    'test-results/postgres/server.json',
    JSON.stringify(
      {
        serverVersion: rows[0].server_version,
        database: 'disposable cloudlane_ci',
      },
      null,
      2,
    ) + '\n',
  );
});
beforeEach(async () => {
  await pool.query('DROP SCHEMA IF EXISTS cloudlane CASCADE');
});
after(async () => {
  try {
    await pool.query('DROP SCHEMA IF EXISTS cloudlane CASCADE');
  } finally {
    await pool.end();
  }
});

test('fresh migration creates a durable single installation and no users, sessions or fixtures', async () => {
  assert.deepEqual(await migrate(pool), ['0001_control_plane']);
  assert.match(await identity(), /^[0-9a-f-]{36}$/);
  for (const table of [
    'users',
    'sessions',
    'workspaces',
    'projects',
    'environments',
  ])
    assert.equal(
      (
        await pool.query(
          `SELECT count(*)::integer AS count FROM cloudlane.${table}`,
        )
      ).rows[0].count,
      0,
    );
  assert.equal(
    (
      await pool.query(
        "SELECT EXISTS (SELECT 1 FROM pg_namespace n, LATERAL aclexplode(n.nspacl) a WHERE n.nspname = 'cloudlane' AND a.grantee = 0 AND a.privilege_type = 'USAGE') AS allowed",
      )
    ).rows[0].allowed,
    false,
  );
});
test('reruns preserve installation identity and existing owner/project data across new connections', async () => {
  await migrate(pool);
  const seeded = await seed();
  const other = new Pool(databaseConfig(url));
  try {
    assert.deepEqual(await migrate(other), []);
  } finally {
    await other.end();
  }
  assert.equal(await identity(), seeded.installationId);
  assert.equal(
    (await pool.query('SELECT id FROM cloudlane.projects')).rows[0].id,
    seeded.projectId,
  );
});
test('two concurrent migrators apply exactly once and produce one installation', async () => {
  const applied = await Promise.all([migrate(pool), migrate(pool)]);
  assert.deepEqual(applied.map((value) => value.length).sort(), [0, 1]);
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::integer AS count FROM cloudlane.installations',
      )
    ).rows[0].count,
    1,
  );
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::integer AS count FROM cloudlane.schema_migrations',
      )
    ).rows[0].count,
    1,
  );
});
test('failure on first install rolls back schema, ledger and installation together', async () => {
  const broken = [
    ...loadMigrations(),
    {
      id: '0002_fail',
      sql: 'CREATE TABLE cloudlane.rollback_probe (id integer); SELECT * FROM cloudlane.missing_table;',
    },
  ];
  await assert.rejects(migrate(pool, broken));
  assert.equal(
    (await pool.query("SELECT to_regnamespace('cloudlane') AS schema")).rows[0]
      .schema,
    null,
  );
  assert.deepEqual(await migrate(pool), ['0001_control_plane']);
});
test('failed upgrade preserves the previous identity, data and migration ledger', async () => {
  await migrate(pool);
  const seeded = await seed();
  await assert.rejects(
    migrate(pool, [
      ...loadMigrations(),
      {
        id: '0002_fail',
        sql: 'CREATE TABLE cloudlane.rollback_probe (id integer); SELECT 1/0;',
      },
    ]),
  );
  assert.equal(await identity(), seeded.installationId);
  assert.equal(
    (
      await pool.query(
        "SELECT to_regclass('cloudlane.rollback_probe') AS probe",
      )
    ).rows[0].probe,
    null,
  );
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::integer AS count FROM cloudlane.schema_migrations',
      )
    ).rows[0].count,
    1,
  );
});
test('changed checksum and newer unknown migration histories block further migration', async () => {
  await migrate(pool);
  const id = await identity();
  await assert.rejects(
    migrate(
      pool,
      loadMigrations().map((m) => ({ ...m, sql: m.sql + '\n-- drift' })),
    ),
  );
  await pool.query(
    "INSERT INTO cloudlane.schema_migrations (id, checksum) VALUES ('9999_future', $1)",
    ['a'.repeat(64)],
  );
  await assert.rejects(migrate(pool));
  assert.equal(await identity(), id);
});
test('a busy migration lock fails within the bounded timeout and can be retried', async () => {
  const holder = await pool.connect();
  try {
    await holder.query('BEGIN');
    await holder.query('SELECT pg_advisory_xact_lock(1129074254, 1)');
    await assert.rejects(migrate(pool));
  } finally {
    await holder.query('ROLLBACK');
    holder.release();
  }
  assert.deepEqual(await migrate(pool), ['0001_control_plane']);
});
test('database constraints enforce one installation and one owner under concurrent inserts', async () => {
  await migrate(pool);
  await assert.rejects(
    pool.query(
      'INSERT INTO cloudlane.installations (singleton) VALUES (false)',
    ),
    sqlCode('23514'),
  );
  const installationId = await identity();
  const insert = (email) =>
    pool.query(
      `INSERT INTO cloudlane.users (installation_id, email, display_name, password_hash) VALUES ($1, $2, 'Owner', $3)`,
      [installationId, email, 'nonfunctional-test-hash'.padEnd(64, '.')],
    );
  const results = await Promise.allSettled([
    insert('one@example.test'),
    insert('two@example.test'),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    results.find((r) => r.status === 'rejected').reason.code,
    '23505',
  );
});
test('workspace/project compound foreign keys reject cross-workspace environments', async () => {
  await migrate(pool);
  const s = await seed(),
    otherWorkspace = randomUUID();
  await pool.query(
    `INSERT INTO cloudlane.workspaces (id, installation_id, owner_user_id, name) VALUES ($1, $2, $3, 'Other')`,
    [otherWorkspace, s.installationId, s.userId],
  );
  await assert.rejects(
    pool.query(
      'INSERT INTO cloudlane.environments (workspace_id, project_id) VALUES ($1, $2)',
      [otherWorkspace, s.projectId],
    ),
    sqlCode('23503'),
  );
  await pool.query(
    'INSERT INTO cloudlane.environments (workspace_id, project_id) VALUES ($1, $2)',
    [s.workspaceId, s.projectId],
  );
  await assert.rejects(
    pool.query(
      'INSERT INTO cloudlane.environments (workspace_id, project_id) VALUES ($1, $2)',
      [s.workspaceId, s.projectId],
    ),
    sqlCode('23505'),
  );
});
test('project slugs are constrained and unique within each workspace', async () => {
  await migrate(pool);
  const s = await seed();
  await assert.rejects(
    pool.query(
      "INSERT INTO cloudlane.projects (workspace_id, name, slug) VALUES ($1, 'Duplicate', 'test-project')",
      [s.workspaceId],
    ),
    sqlCode('23505'),
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO cloudlane.projects (workspace_id, name, slug) VALUES ($1, 'Traversal', '../bad')",
      [s.workspaceId],
    ),
    sqlCode('23514'),
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO cloudlane.projects (workspace_id, name, slug) VALUES ($1, '', 'empty')",
      [s.workspaceId],
    ),
    sqlCode('23514'),
  );
});
test('session records require hashes, valid lifetime ordering and an owned workspace', async () => {
  await migrate(pool);
  const s = await seed();
  const insert = (user, hash, idle = 60, absolute = 120) =>
    pool.query(
      `INSERT INTO cloudlane.sessions (user_id, workspace_id, token_hash, idle_expires_at, absolute_expires_at) VALUES ($1, $2, $3, clock_timestamp() + $4 * interval '1 second', clock_timestamp() + $5 * interval '1 second')`,
      [user, s.workspaceId, hash, idle, absolute],
    );
  await assert.rejects(insert(s.userId, randomBytes(16)), sqlCode('23514'));
  await assert.rejects(insert(randomUUID(), randomBytes(32)), sqlCode('23503'));
  await assert.rejects(
    insert(s.userId, randomBytes(32), 180, 120),
    sqlCode('23514'),
  );
  await assert.rejects(
    insert(s.userId, randomBytes(32), -10, 120),
    sqlCode('23514'),
  );
  await insert(s.userId, randomBytes(32));
});
test('a readiness-only runtime role can read the ledger but cannot modify it', async () => {
  await migrate(pool);
  const role = 'cl_test_' + randomUUID().replaceAll('-', '');
  await pool.query(`CREATE ROLE ${role} NOLOGIN`);
  const client = await pool.connect();
  try {
    await pool.query(`GRANT USAGE ON SCHEMA cloudlane TO ${role}`);
    await pool.query(`GRANT SELECT ON cloudlane.schema_migrations TO ${role}`);
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${role}`);
    assert.equal(
      (
        await client.query(
          'SELECT count(*)::integer AS count FROM cloudlane.schema_migrations',
        )
      ).rows[0].count,
      1,
    );
    await assert.rejects(
      client.query('DELETE FROM cloudlane.schema_migrations'),
      sqlCode('42501'),
    );
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.query(`DROP OWNED BY ${role}`);
    await pool.query(`DROP ROLE ${role}`);
  }
});
test('real database readiness detects migration state and never reports authentication ready', async () => {
  const db = new PlatformDatabase(url);
  const app = await createApp({ documentation: false, database: db });
  try {
    await app.listen(0, '127.0.0.1');
    const origin = await app.getUrl();
    assert.equal(await db.status(), 'migration_required');
    await migrate(pool);
    assert.equal(await db.status(), 'ready');
    const s = await seed(),
      token = randomBytes(32).toString('base64url');
    await pool.query(
      `INSERT INTO cloudlane.sessions (user_id, workspace_id, token_hash, idle_expires_at, absolute_expires_at) VALUES ($1, $2, $3, clock_timestamp() + interval '1 minute', clock_timestamp() + interval '2 minutes')`,
      [s.userId, s.workspaceId, createHash('sha256').update(token).digest()],
    );
    const response = await fetch(`${origin}/api/v1/health/ready`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      status: 'not_ready',
      database: 'ready',
      authentication: 'unavailable',
    });
    const session = await fetch(`${origin}/api/v1/auth/session`, {
      headers: { Cookie: `__Host-cloudlane_session=${token}` },
    });
    assert.equal(session.status, 401);
    await pool.query('UPDATE cloudlane.schema_migrations SET checksum = $1', [
      '0'.repeat(64),
    ]);
    assert.equal(await db.status(), 'unavailable');
  } finally {
    await app.close();
  }
});
