import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AuthClient } from '../apps/dashboard/src/lib/api/auth.ts';
const origin = 'https://panel.example.test',
  nonce = 'A'.repeat(43),
  next = 'B'.repeat(43);
const challenge = () => ({
  state: 'mfa_required',
  csrfToken: nonce,
  expiresAt: new Date(Date.now() + 300000).toISOString(),
});
test('auth client restricts secret submission to its canonical HTTPS origin', () => {
  for (const url of [
    'http://localhost',
    'https://panel.example.test/',
    'https://panel.example.test?token=x',
    'https://user:pass@panel.example.test',
  ])
    assert.throws(() => new AuthClient(url));
});
test('auth client sends cookies, custom header and memory-only rotating CSRF; redirect following is disabled', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push([url, options]);
    if (url.endsWith('/login')) return Response.json(challenge());
    if (url.endsWith('/verify'))
      return Response.json({
        state: 'recovery_codes_required',
        csrfToken: next,
        expiresAt: challenge().expiresAt,
        codes: Array(10).fill('aaaa-aaaa-aaaa-aaaa-aaaa-aaaa-aaaa-aaaa'),
      });
    return Response.json({ signedOut: true });
  });
  const client = new AuthClient(origin);
  await client.login('owner@example.test', 'private password');
  await client.verify('123456', false);
  await client.logout();
  assert.ok(
    calls.every(
      ([url, o]) =>
        url.startsWith(origin + '/api/v1/') &&
        o.credentials === 'include' &&
        o.redirect === 'error' &&
        o.cache === 'no-store' &&
        o.headers['X-Cloudlane-Request'] === 'owner-auth',
    ),
  );
  assert.equal(calls[0][1].headers['X-CSRF-Token'], undefined);
  assert.equal(calls[1][1].headers['X-CSRF-Token'], nonce);
  assert.equal(calls[2][1].headers['X-CSRF-Token'], next);
  client.dispose();
  assert.equal(calls[0][1].signal.aborted, true);
});
test('password responses cannot masquerade as full sessions; unverified session responses are denied', async (t) => {
  const session = {
    authenticated: true,
    user: {
      id: randomUUID(),
      email: 'owner@example.test',
      displayName: 'Owner',
      role: 'owner',
    },
    workspace: { id: randomUUID(), name: 'Workspace' },
  };
  t.mock.method(globalThis, 'fetch', async () => Response.json(session));
  const client = new AuthClient(origin);
  await assert.rejects(
    client.login('owner@example.test', 'secret'),
    (e) => e.code === 'INVALID_API_RESPONSE',
  );
  await assert.rejects(client.session(), (e) => e.code === 'SESSION_REQUIRED');
  client.dispose();
});
test('auth client sanitizes API errors and rejects HTML or redirects without echoing secrets', async (t) => {
  let response = Response.json(
    {
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: 'raw-secret-from-untrusted-message',
        requestId: randomUUID(),
      },
    },
    { status: 401 },
  );
  t.mock.method(globalThis, 'fetch', async () => response);
  const client = new AuthClient(origin);
  await assert.rejects(
    client.login('owner@example.test', 'private'),
    (e) => e.status === 401 && !e.message.includes('raw-secret'),
  );
  response = new Response('<html>bad</html>', {
    headers: { 'Content-Type': 'text/html' },
  });
  await assert.rejects(
    client.login('owner@example.test', 'private'),
    (e) => e.code === 'INVALID_API_RESPONSE',
  );
  client.dispose();
});
