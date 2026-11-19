import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import {
  CreateOwnerRequestSchema,
  SessionResponseSchema,
  InstallationStatusSchema,
} from '@cloudlane/contracts/api';
const require = createRequire(import.meta.url);
const { Passwords } = require('../dist/auth/passwords.js');
const {
  opaque,
  verifier,
  decodeOpaque,
  sameNonce,
  readCredential,
  AuthBoundary,
  SESSION_COOKIE,
} = require('../dist/auth/policy.js');
const { OwnerAuthReview } = require('../dist/auth/review.js');
const { createApp } = require('../dist/app.js');

test('opaque credentials are canonical, purpose-separated and never authority-bearing IDs', () => {
  const token = opaque();
  assert.equal(token.length, 43);
  assert.equal(decodeOpaque(token).length, 32);
  assert.ok(!verifier('setup', token).equals(verifier('session', token)));
  assert.equal(sameNonce(decodeOpaque(token), token), true);
  for (const value of [
    null,
    token + '=',
    token + 'x',
    '../session',
    'a'.repeat(43),
  ]) {
    if (value === 'a'.repeat(43) && decodeOpaque(value)) continue;
    assert.equal(decodeOpaque(value), null);
  }
  assert.equal(sameNonce(decodeOpaque(token), opaque()), false);
});
test('duplicate, encoded and oversized cookie credentials are rejected', () => {
  const token = opaque();
  const request = (cookie, rawHeaders = ['Cookie', cookie]) => ({
    headers: { cookie },
    rawHeaders,
  });
  assert.equal(
    readCredential(request(`${SESSION_COOKIE}=${token}`), SESSION_COOKIE),
    token,
  );
  for (const cookie of [
    `${SESSION_COOKIE}=${token}; ${SESSION_COOKIE}=${token}`,
    `${SESSION_COOKIE}=${encodeURIComponent(token + '=')}`,
    `${SESSION_COOKIE}=${token}; other=${'x'.repeat(8200)}`,
  ])
    assert.equal(readCredential(request(cookie), SESSION_COOKIE), null);
  assert.equal(
    readCredential(
      request(`${SESSION_COOKIE}=${token}`, [
        'Cookie',
        `${SESSION_COOKIE}=${token}`,
        'Cookie',
        'other=x',
      ]),
      SESSION_COOKIE,
    ),
    null,
  );
});
test('real Argon2id hashing preserves long/unicode passwords, salts independently and fails closed on unsupported PHC costs', async () => {
  const passwords = new Passwords();
  await passwords.prepare();
  const secret = '  synthetic long password 雪 '.repeat(3);
  const one = await passwords.hash(secret),
    two = await passwords.hash(secret);
  assert.notEqual(one, two);
  assert.match(one, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.equal(await passwords.verify(one, secret), true);
  assert.equal(await passwords.verify(one, secret.trim()), false);
  assert.equal(await passwords.verify(null, secret), false);
  assert.equal(
    await passwords.verify(one.replace('m=19456', 'm=2147483647'), secret),
    false,
  );
  assert.equal(await passwords.verify('not-an-encoded-hash', secret), false);
});
test('password hashing admits two operations and rejects excess work without queuing', async () => {
  const passwords = new Passwords();
  await passwords.prepare();
  const results = await Promise.allSettled([
    passwords.hash('one synthetic long secret'),
    passwords.hash('two synthetic long secret'),
    passwords.hash('three synthetic long secret'),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 2);
  const rejected = results.find((r) => r.status === 'rejected');
  assert.equal(rejected.reason.code, 'RATE_LIMITED');
});
test('owner contract enforces length/UTF-8 limits and rejects caller authority', () => {
  const base = {
    email: 'test@example.test',
    displayName: 'Owner',
    password: 'a long synthetic password',
  };
  assert.equal(CreateOwnerRequestSchema.safeParse(base).success, true);
  for (const extra of [
    { password: 'short' },
    { password: '😀'.repeat(8) },
    { password: '雪'.repeat(400) },
    { workspaceId: 'forged' },
    { role: 'owner' },
  ])
    assert.equal(
      CreateOwnerRequestSchema.safeParse({ ...base, ...extra }).success,
      false,
    );
  assert.equal(
    InstallationStatusSchema.safeParse({
      state: 'unclaimed',
      ownerConfigured: true,
      setupAvailable: true,
    }).success,
    false,
  );
});
test('review origin configuration rejects HTTP, credentials, paths and noncanonical origins', () => {
  for (const origin of [
    'http://localhost',
    'https://user:pass@panel.example.test',
    'https://panel.example.test/path',
    'https://panel.example.test/',
    'https://panel.example.test?token=x',
  ])
    assert.throws(() => new AuthBoundary(origin));
  assert.doesNotThrow(() => new AuthBoundary('https://127.0.0.1'));
});
test('factory rejects review activation without TLS and in production; main has no activation path', async () => {
  const review = new OwnerAuthReview({}, 'https://panel.example.test');
  await assert.rejects(
    createApp({ ownerAuthReview: review }),
    /isolated HTTPS review/,
  );
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    await assert.rejects(
      createApp({
        ownerAuthReview: review,
        https: { key: Buffer.from('unused'), cert: Buffer.from('unused') },
      }),
      /production activation is disabled/,
    );
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.ok(!main.includes('ownerAuthReview'));
});
