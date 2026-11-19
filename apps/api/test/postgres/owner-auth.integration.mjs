import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import { once } from 'node:events';
import { assertDisposableDatabase } from '../../../../scripts/run-postgres-tests.mjs';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { Pool } = require('pg');
const { databaseConfig } = require('./dist/database/config.js');
const { migrate } = require('./dist/database/migrations.js');
const { PlatformDatabase } = require('./dist/database/database.js');
const { OwnerAuthReview } = require('./dist/auth/review.js');
const {
  SESSION_COOKIE,
  SETUP_COOKIE,
  verifier,
} = require('./dist/auth/policy.js');
const { createApp } = require('./dist/app.js');
assertDisposableDatabase(process.env);
const pool = new Pool(databaseConfig(process.env.CLOUDLANE_TEST_DATABASE_URL));
const key = readFileSync('test-results/auth-fixture/key.pem');
const cert = readFileSync('test-results/auth-fixture/cert.pem');
const origin = 'https://panel.example.test';
let review, app, port, plain, plainPort;
const owner = {
  email: 'Owner@Example.test',
  displayName: 'Owner',
  password: 'synthetic private owner password 雪',
};
function call(
  path,
  {
    method = 'GET',
    body,
    headers = {},
    plaintext = false,
    targetPort = port,
    ipHost = false,
  } = {},
) {
  const h = {
    Host: ipHost ? '127.0.0.1' : 'panel.example.test',
    Origin: ipHost ? 'https://127.0.0.1' : origin,
    'Content-Type': 'application/json',
    'X-Cloudlane-Request': 'owner-auth',
    ...headers,
  };
  for (const name of Object.keys(h)) if (h[name] === null) delete h[name];
  return new Promise((resolve, reject) => {
    const request = (plaintext ? http : https).request(
      {
        hostname: '127.0.0.1',
        port: plaintext ? plainPort : targetPort,
        path: '/api/v1/' + path,
        method,
        headers: h,
        ca: cert,
        servername: ipHost ? undefined : 'panel.example.test',
        agent: false,
      },
      (response) => {
        if (!plaintext) assert.equal(response.socket.authorized, true);
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          raw += chunk;
        });
        response.on('end', () => {
          try {
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body: JSON.parse(raw),
            });
          } catch {
            reject(new Error('Non-JSON review response: ' + raw.slice(0, 150)));
          }
        });
      },
    );
    request.on('error', reject);
    request.setTimeout(10000, () =>
      request.destroy(new Error('Review request timed out')),
    );
    if (body !== undefined) request.write(JSON.stringify(body));
    request.end();
  });
}
const post = (path, body, options = {}) =>
  call(path, { method: 'POST', body, ...options });
function cookie(response, name) {
  return (
    response.headers['set-cookie']
      ?.find((value) => value.startsWith(name + '='))
      ?.split(';')[0] ?? ''
  );
}
function value(cookieString) {
  return cookieString.slice(cookieString.indexOf('=') + 1);
}
function denied(response, status = 401, code = 'AUTHENTICATION_FAILED') {
  assert.equal(response.status, status);
  assert.equal(response.body.error.code, code);
  assert.equal(response.headers['set-cookie'], undefined);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.body.error.requestId, response.headers['x-request-id']);
}
async function setup() {
  const code = await review.store.issueClaim();
  const response = await post('bootstrap/claim', { code });
  assert.equal(response.status, 200);
  return {
    code,
    cookie: cookie(response, SETUP_COOKIE),
    csrf: response.body.csrfToken,
  };
}
async function createOwner(lease) {
  return post('bootstrap/owner', owner, {
    headers: { Cookie: lease.cookie, 'X-CSRF-Token': lease.csrf },
  });
}
async function owned() {
  const lease = await setup();
  assert.equal((await createOwner(lease)).status, 200);
  return lease;
}
async function login(headers = {}) {
  const response = await post(
    'auth/login',
    { email: owner.email, password: owner.password },
    { headers },
  );
  assert.equal(response.status, 200);
  return {
    response,
    cookie: cookie(response, SESSION_COOKIE),
    csrf: response.body.csrfToken,
  };
}
const authHeaders = (session) => ({
  Cookie: session.cookie,
  'X-CSRF-Token': session.csrf,
});
before(async () => {
  review = new OwnerAuthReview(pool, origin);
  app = await createApp({
    documentation: false,
    ownerAuthReview: review,
    database: new PlatformDatabase(process.env.CLOUDLANE_TEST_DATABASE_URL),
    https: { key, cert },
  });
  await app.listen(0, '127.0.0.1');
  port = app.getHttpServer().address().port;
  plain = http.createServer(app.getHttpAdapter().getInstance());
  plain.listen(0, '127.0.0.1');
  await once(plain, 'listening');
  plainPort = plain.address().port;
});
beforeEach(async () => {
  await pool.query('DROP SCHEMA IF EXISTS cloudlane CASCADE');
  await migrate(pool);
});
after(async () => {
  await app?.close();
  if (plain) await new Promise((resolve) => plain.close(resolve));
  try {
    await pool.query('DROP SCHEMA IF EXISTS cloudlane CASCADE');
  } finally {
    await pool.end();
  }
});

test('public lifecycle contains no identity/claim material and never declares production readiness', async () => {
  assert.deepEqual((await call('installation/status')).body, {
    state: 'unclaimed',
    ownerConfigured: false,
    setupAvailable: false,
  });
  const code = await review.store.issueClaim();
  const status = await call('installation/status');
  assert.deepEqual(status.body, {
    state: 'unclaimed',
    ownerConfigured: false,
    setupAvailable: true,
  });
  assert.ok(!JSON.stringify(status).includes(code));
  const ready = await call('health/ready');
  assert.equal(ready.status, 503);
  assert.deepEqual(ready.body, {
    status: 'not_ready',
    database: 'ready',
    authentication: 'review_only',
  });
});
test('one claim exchange wins a concurrent race; replay, wrong and cross-instance codes fail', async () => {
  const code = await review.store.issueClaim();
  denied(
    await post('bootstrap/claim', { code: randomUUID() + code.slice(36) }),
  );
  const results = await Promise.all([
    post('bootstrap/claim', { code }),
    post('bootstrap/claim', { code }),
  ]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  denied(results.find((r) => r.status !== 200));
  denied(await post('bootstrap/claim', { code }));
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::integer AS n FROM cloudlane.bootstrap_setups',
      )
    ).rows[0].n,
    1,
  );
});
test('expired claims and regenerated codes cannot open setup', async () => {
  const old = await review.store.issueClaim();
  const current = await review.store.issueClaim();
  denied(await post('bootstrap/claim', { code: old }));
  await pool.query(
    "UPDATE cloudlane.bootstrap_claims SET issued_at = clock_timestamp() - interval '1 hour', expires_at = clock_timestamp() - interval '1 second'",
  );
  denied(await post('bootstrap/claim', { code: current }));
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::integer AS n FROM cloudlane.bootstrap_setups',
      )
    ).rows[0].n,
    0,
  );
});
test('claim verifier attempts remain durable and bounded after ten failures', async () => {
  const code = await review.store.issueClaim();
  for (let i = 0; i < 10; i++)
    denied(await post('bootstrap/claim', { code: 'wrong-' + i }));
  assert.equal(
    (await pool.query('SELECT attempts FROM cloudlane.bootstrap_claims'))
      .rows[0].attempts,
    10,
  );
  await pool.query('DELETE FROM cloudlane.auth_rate_limits');
  denied(await post('bootstrap/claim', { code }));
});
test('one owner/workspace is created atomically under concurrent requests; all bootstrap material becomes unusable', async () => {
  const lease = await setup();
  const results = await Promise.all([createOwner(lease), createOwner(lease)]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  denied(results.find((r) => r.status !== 200));
  const success = results.find((r) => r.status === 200);
  assert.equal(success.body.state, 'mfa_setup_required');
  assert.match(success.headers['set-cookie'][0], /Max-Age=0/);
  for (const table of ['users', 'workspaces'])
    assert.equal(
      (
        await pool.query(
          `SELECT count(*)::integer AS n FROM cloudlane.${table}`,
        )
      ).rows[0].n,
      1,
    );
  assert.equal((await call('installation/status')).body.state, 'active');
  await assert.rejects(review.store.issueClaim(), (e) => e.code === 'CONFLICT');
  denied(await createOwner(lease));
  denied(await post('bootstrap/claim', { code: lease.code }));
});
test('owner creation rollback preserves the setup lease and never leaves a partial owner', async () => {
  const lease = await setup();
  await pool.query(`CREATE FUNCTION cloudlane.reject_workspace() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic-private-db-failure'; END $$;
    CREATE TRIGGER reject_workspace BEFORE INSERT ON cloudlane.workspaces FOR EACH ROW EXECUTE FUNCTION cloudlane.reject_workspace()`);
  const failure = await createOwner(lease);
  denied(failure, 503, 'API_UNAVAILABLE');
  assert.ok(!JSON.stringify(failure).includes('synthetic-private'));
  assert.equal(
    (await pool.query('SELECT count(*)::integer AS n FROM cloudlane.users'))
      .rows[0].n,
    0,
  );
  assert.equal(
    (await pool.query('SELECT consumed_at FROM cloudlane.bootstrap_setups'))
      .rows[0].consumed_at,
    null,
  );
  await pool.query('DROP TRIGGER reject_workspace ON cloudlane.workspaces');
  assert.equal((await createOwner(lease)).status, 200);
});
test('expired/revoked setup leases, forged authority and wrong setup CSRF cannot create an owner', async () => {
  const lease = await setup();
  denied(
    await post('bootstrap/owner', owner, {
      headers: { Cookie: lease.cookie, 'X-CSRF-Token': 'wrong' },
    }),
    403,
    'FORBIDDEN',
  );
  denied(
    await post(
      'bootstrap/owner',
      { ...owner, role: 'owner', workspaceId: randomUUID() },
      { headers: { Cookie: lease.cookie, 'X-CSRF-Token': lease.csrf } },
    ),
    400,
    'VALIDATION_ERROR',
  );
  await pool.query(
    "UPDATE cloudlane.bootstrap_setups SET created_at = clock_timestamp() - interval '1 hour', expires_at = clock_timestamp() - interval '1 second'",
  );
  denied(await createOwner(lease));
  const fresh = await setup();
  await review.store.issueClaim();
  denied(await createOwner(fresh));
  assert.equal(
    (await pool.query('SELECT count(*)::integer AS n FROM cloudlane.users'))
      .rows[0].n,
    0,
  );
});
test('owner creation rechecks setup expiry after preflight and hashing', async () => {
  const lease = await setup();
  const record = await review.store.setup(value(lease.cookie));
  const passwordHash = await review.passwords.hash(owner.password);
  await pool.query(
    "UPDATE cloudlane.bootstrap_setups SET created_at = clock_timestamp() - interval '1 hour', expires_at = clock_timestamp() - interval '1 second'",
  );
  assert.equal(
    await review.store.createOwner(
      record.id,
      {
        email: owner.email.toLowerCase(),
        displayName: owner.displayName,
        passwordHash,
      },
      randomUUID(),
    ),
    false,
  );
  assert.equal(
    (await pool.query('SELECT count(*)::integer AS n FROM cloudlane.users'))
      .rows[0].n,
    0,
  );
});
test('login rechecks a password hash changed after credential verification', async () => {
  await owned();
  const snapshot = await review.store.findUser(owner.email.toLowerCase());
  assert.equal(
    await review.passwords.verify(snapshot.password_hash, owner.password),
    true,
  );
  const replacement = await review.passwords.hash(
    'different synthetic private password',
  );
  await pool.query('UPDATE cloudlane.users SET password_hash = $1', [
    replacement,
  ]);
  assert.equal(
    await review.store.login(snapshot, true, null, randomUUID()),
    null,
  );
  assert.equal(
    (await pool.query('SELECT count(*)::integer AS n FROM cloudlane.sessions'))
      .rows[0].n,
    0,
  );
});
test('real Argon2 login returns host-only secure cookies, a CSRF nonce and server-derived owner data', async () => {
  await owned();
  const s = await login();
  const cookieHeader = s.response.headers['set-cookie'][0];
  for (const flag of ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/'])
    assert.ok(cookieHeader.includes(flag));
  assert.ok(!/Domain=/i.test(cookieHeader));
  assert.equal(value(s.cookie).length, 43);
  assert.equal(s.response.body.user.email, owner.email.toLowerCase());
  const current = await call('auth/session', {
    headers: {
      Cookie: s.cookie,
      'X-Workspace-Id': randomUUID(),
      'X-User-Role': 'viewer',
    },
  });
  assert.equal(current.status, 200);
  assert.deepEqual(current.body, s.response.body);
  const row = (
    await pool.query(
      'SELECT u.password_hash, s.token_hash, s.csrf_token FROM cloudlane.users u JOIN cloudlane.sessions s ON s.user_id = u.id',
    )
  ).rows[0];
  assert.match(row.password_hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.ok(!row.password_hash.includes(owner.password));
  assert.ok(row.token_hash.equals(verifier('session', value(s.cookie))));
  assert.ok(!row.token_hash.equals(Buffer.from(value(s.cookie), 'base64url')));
});
test('missing users, wrong passwords and disabled owners have identical errors and no cookies', async () => {
  await owned();
  const missing = await post('auth/login', {
    email: 'absent@example.test',
    password: owner.password,
  });
  const wrong = await post('auth/login', {
    email: owner.email,
    password: 'incorrect synthetic password',
  });
  await pool.query(
    'UPDATE cloudlane.users SET disabled_at = clock_timestamp()',
  );
  const disabled = await post('auth/login', {
    email: owner.email,
    password: owner.password,
  });
  for (const response of [missing, wrong, disabled]) denied(response);
  assert.equal(missing.body.error.message, wrong.body.error.message);
  assert.equal(wrong.body.error.message, disabled.body.error.message);
});
test('login always replaces an incoming credential and revokes its prior session family', async () => {
  await owned();
  const one = await login({ Cookie: SESSION_COOKIE + '=forged' });
  const two = await login({ Cookie: one.cookie });
  assert.notEqual(one.cookie, two.cookie);
  denied(
    await call('auth/session', { headers: { Cookie: one.cookie } }),
    401,
    'SESSION_REQUIRED',
  );
  assert.equal(
    (await call('auth/session', { headers: { Cookie: two.cookie } })).status,
    200,
  );
});
test('cookie authentication rejects bearer/agent alternatives and duplicate cookie/CSRF inputs', async () => {
  await owned();
  const s = await login();
  denied(
    await call('auth/session', {
      headers: {
        Authorization: 'Bearer ' + value(s.cookie),
        'X-Agent-Token': value(s.cookie),
      },
    }),
    401,
    'SESSION_REQUIRED',
  );
  denied(
    await call('auth/session', {
      headers: { Cookie: s.cookie + '; ' + s.cookie },
    }),
    401,
    'SESSION_REQUIRED',
  );
  denied(
    await post(
      'auth/logout',
      {},
      { headers: { Cookie: s.cookie, 'X-CSRF-Token': [s.csrf, s.csrf] } },
    ),
    403,
    'FORBIDDEN',
  );
});
test('all authenticated mutations reject missing/wrong CSRF and exact-origin violations', async () => {
  await owned();
  const s = await login();
  for (const path of ['auth/logout', 'auth/session/rotate']) {
    for (const headers of [
      { Cookie: s.cookie },
      { Cookie: s.cookie, 'X-CSRF-Token': 'wrong' },
      { ...authHeaders(s), Origin: null },
      { ...authHeaders(s), Origin: 'null' },
      { ...authHeaders(s), Origin: 'https://sibling.example.test' },
    ])
      denied(await post(path, {}, { headers }), 403, 'FORBIDDEN');
  }
  assert.equal(
    (await call('auth/session', { headers: { Cookie: s.cookie } })).status,
    200,
  );
});
test('login/claim deny cross-origin, missing custom header, query secrets and HTTP even with forged Forwarded headers', async () => {
  const code = await review.store.issueClaim();
  for (const headers of [
    { Origin: null },
    { Origin: 'null' },
    { Origin: 'https://sibling.example.test' },
    { Host: 'evil.example.test' },
    { 'X-Cloudlane-Request': null },
    { 'Sec-Fetch-Site': 'cross-site' },
  ]) {
    denied(
      await post('bootstrap/claim', { code }, { headers }),
      403,
      'FORBIDDEN',
    );
    denied(
      await post(
        'auth/login',
        { email: owner.email, password: owner.password },
        { headers },
      ),
      403,
      'FORBIDDEN',
    );
  }
  denied(
    await post('bootstrap/claim?code=synthetic-url-secret', { code }),
    403,
    'FORBIDDEN',
  );
  denied(
    await post(
      'bootstrap/claim',
      { code },
      {
        plaintext: true,
        headers: {
          'X-Forwarded-Proto': 'https',
          Forwarded: 'proto=https;host=panel.example.test',
        },
      },
    ),
    403,
    'FORBIDDEN',
  );
  assert.equal(
    (await pool.query('SELECT consumed_at FROM cloudlane.bootstrap_claims'))
      .rows[0].consumed_at,
    null,
  );
});
test('idle/absolute expiry, direct revocation and disabled owners invalidate existing cookies', async () => {
  await owned();
  const idle = await login();
  await pool.query(
    "UPDATE cloudlane.sessions SET created_at = clock_timestamp() - interval '2 hours', last_seen_at = clock_timestamp() - interval '1 hour', idle_expires_at = clock_timestamp() - interval '1 second'",
  );
  denied(
    await call('auth/session', { headers: { Cookie: idle.cookie } }),
    401,
    'SESSION_REQUIRED',
  );
  const absolute = await login();
  await pool.query(
    "UPDATE cloudlane.sessions SET created_at = clock_timestamp() - interval '4 hours', last_seen_at = clock_timestamp() - interval '3 hours', idle_expires_at = clock_timestamp() - interval '2 hours', absolute_expires_at = clock_timestamp() - interval '1 hour'",
  );
  denied(
    await call('auth/session', { headers: { Cookie: absolute.cookie } }),
    401,
    'SESSION_REQUIRED',
  );
  const revoked = await login();
  await pool.query(
    'UPDATE cloudlane.sessions SET revoked_at = clock_timestamp() WHERE token_hash = $1',
    [verifier('session', value(revoked.cookie))],
  );
  denied(
    await call('auth/session', { headers: { Cookie: revoked.cookie } }),
    401,
    'SESSION_REQUIRED',
  );
  const disabled = await login();
  await pool.query(
    'UPDATE cloudlane.users SET disabled_at = clock_timestamp()',
  );
  denied(
    await call('auth/session', { headers: { Cookie: disabled.cookie } }),
    401,
    'SESSION_REQUIRED',
  );
});
test('rotation changes credential/CSRF, preserves absolute lifetime and old credential can only revoke its family', async () => {
  await owned();
  const s = await login();
  const before = (
    await pool.query(
      'SELECT absolute_expires_at FROM cloudlane.sessions WHERE token_hash = $1',
      [verifier('session', value(s.cookie))],
    )
  ).rows[0].absolute_expires_at;
  const response = await post(
    'auth/session/rotate',
    {},
    { headers: authHeaders(s) },
  );
  assert.equal(response.status, 200);
  const next = {
    cookie: cookie(response, SESSION_COOKIE),
    csrf: response.body.csrfToken,
  };
  assert.notEqual(next.cookie, s.cookie);
  assert.notEqual(next.csrf, s.csrf);
  const after = (
    await pool.query(
      'SELECT absolute_expires_at FROM cloudlane.sessions WHERE token_hash = $1',
      [verifier('session', value(next.cookie))],
    )
  ).rows[0].absolute_expires_at;
  assert.equal(before.getTime(), after.getTime());
  denied(
    await call('auth/session', { headers: { Cookie: s.cookie } }),
    401,
    'SESSION_REQUIRED',
  );
  denied(
    await post('auth/session/rotate', {}, { headers: authHeaders(s) }),
    401,
    'SESSION_REQUIRED',
  );
  denied(
    await post(
      'auth/logout',
      {},
      { headers: { Cookie: s.cookie, 'X-CSRF-Token': next.csrf } },
    ),
    403,
    'FORBIDDEN',
  );
  const out = await post('auth/logout', {}, { headers: authHeaders(s) });
  assert.equal(out.status, 200);
  assert.match(out.headers['set-cookie'][0], /Max-Age=0/);
  denied(
    await call('auth/session', { headers: { Cookie: next.cookie } }),
    401,
    'SESSION_REQUIRED',
  );
});
test('concurrent rotations produce one successor and a concurrent logout cannot leave a live successor', async () => {
  await owned();
  const s = await login();
  const pair = await Promise.all([
    post('auth/session/rotate', {}, { headers: authHeaders(s) }),
    post('auth/session/rotate', {}, { headers: authHeaders(s) }),
  ]);
  assert.equal(pair.filter((r) => r.status === 200).length, 1);
  const success = pair.find((r) => r.status === 200),
    next = {
      cookie: cookie(success, SESSION_COOKIE),
      csrf: success.body.csrfToken,
    };
  const race = await Promise.all([
    post('auth/session/rotate', {}, { headers: authHeaders(next) }),
    post('auth/logout', {}, { headers: authHeaders(next) }),
  ]);
  assert.equal(race[1].status, 200);
  const newerCookie =
    race[0].status === 200 ? cookie(race[0], SESSION_COOKIE) : next.cookie;
  denied(
    await call('auth/session', { headers: { Cookie: newerCookie } }),
    401,
    'SESSION_REQUIRED',
  );
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::integer AS n FROM cloudlane.session_families WHERE revoked_at IS NULL',
      )
    ).rows[0].n,
    0,
  );
});
test('durable throttling is shared by independent runtimes and expires without resetting owner data', async () => {
  await owned();
  for (let i = 0; i < 5; i++)
    denied(
      await post('auth/login', {
        email: owner.email,
        password: 'incorrect synthetic password',
      }),
    );
  const other = new OwnerAuthReview(pool, origin);
  await assert.rejects(
    other.store.budget('login', '127.0.0.1', owner.email.toLowerCase()),
    (e) => e.code === 'RATE_LIMITED',
  );
  denied(
    await post('auth/login', { email: owner.email, password: owner.password }),
    429,
    'RATE_LIMITED',
  );
  await pool.query(
    "UPDATE cloudlane.auth_rate_limits SET expires_at = clock_timestamp() - interval '1 second'",
  );
  assert.equal((await login()).response.status, 200);
  assert.equal(
    (await pool.query('SELECT count(*)::integer AS n FROM cloudlane.users'))
      .rows[0].n,
    1,
  );
});
test('audit rows and database verifiers contain no raw password, session or claim credential', async () => {
  const lease = await owned(),
    s = await login();
  denied(
    await post('auth/login', {
      email: owner.email,
      password: 'incorrect synthetic password',
    }),
  );
  const data = {};
  for (const table of [
    'auth_audit',
    'auth_rate_limits',
    'bootstrap_claims',
    'bootstrap_setups',
    'sessions',
  ])
    data[table] = (await pool.query(`SELECT * FROM cloudlane.${table}`)).rows;
  const serialized = JSON.stringify(data);
  for (const secret of [
    owner.password,
    lease.code,
    value(lease.cookie),
    value(s.cookie),
  ])
    assert.ok(!serialized.includes(secret));
  assert.ok(data.auth_audit.some((row) => row.outcome === 'denied'));
  assert.deepEqual(
    Object.keys(data.auth_audit[0]).sort(),
    [
      'id',
      'installation_id',
      'user_id',
      'request_id',
      'action',
      'outcome',
      'created_at',
    ].sort(),
  );
});
test('IP-host TLS cookies have the same flags and cannot change server-derived workspace scope', async () => {
  const ipReview = new OwnerAuthReview(pool, 'https://127.0.0.1');
  const ipApp = await createApp({
    documentation: false,
    ownerAuthReview: ipReview,
    https: { key, cert },
  });
  await ipApp.listen(0, '127.0.0.1');
  const targetPort = ipApp.getHttpServer().address().port;
  try {
    const code = await ipReview.store.issueClaim();
    const claim = await post(
      'bootstrap/claim',
      { code },
      { targetPort, ipHost: true },
    );
    const made = await post('bootstrap/owner', owner, {
      targetPort,
      ipHost: true,
      headers: {
        Cookie: cookie(claim, SETUP_COOKIE),
        'X-CSRF-Token': claim.body.csrfToken,
      },
    });
    assert.equal(made.status, 200);
    const logged = await post(
      'auth/login',
      { email: owner.email, password: owner.password },
      { targetPort, ipHost: true },
    );
    assert.equal(logged.status, 200);
    for (const flag of ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/'])
      assert.ok(logged.headers['set-cookie'][0].includes(flag));
    assert.ok(!logged.headers['set-cookie'][0].includes('Domain='));
    const extraWorkspace = randomUUID(),
      user = (
        await pool.query('SELECT id, installation_id FROM cloudlane.users')
      ).rows[0];
    await pool.query(
      "INSERT INTO cloudlane.workspaces (id, installation_id, owner_user_id, name) VALUES ($1, $2, $3, 'Other')",
      [extraWorkspace, user.installation_id, user.id],
    );
    await assert.rejects(
      pool.query('UPDATE cloudlane.sessions SET workspace_id = $1', [
        extraWorkspace,
      ]),
      (e) => e.code === '23503',
    );
    const current = await call('auth/session', {
      targetPort,
      ipHost: true,
      headers: {
        Cookie: cookie(logged, SESSION_COOKIE),
        'X-Workspace-Id': extraWorkspace,
      },
    });
    assert.equal(current.body.workspace.id, logged.body.workspace.id);
  } finally {
    await ipApp.close();
  }
});
