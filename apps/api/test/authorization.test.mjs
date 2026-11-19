import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Reflector } = require('@nestjs/core');
const {
  AuthorizationGuard,
  DisabledSessionResolver,
  OwnerRoute,
  PublicRoute,
  ownerContext,
} = require('../dist/common/authorization.js');

function fixture({ session, access = 'owner', failure = false } = {}) {
  const handler = () => {};
  if (access === 'owner') OwnerRoute()(handler);
  if (access === 'public') PublicRoute()(handler);
  const request = {
    headers: { authorization: 'Bearer forged', 'x-owner-id': randomUUID() },
    body: { role: 'owner', workspaceId: randomUUID() },
    user: { role: 'owner' },
  };
  const context = {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => request }),
  };
  const resolver = {
    async resolve() {
      if (failure) throw new Error('private-session-store-details');
      return session;
    },
  };
  return {
    request,
    context,
    resolver,
    guard: new AuthorizationGuard(new Reflector(), resolver),
  };
}
const validSession = () => ({
  actorType: 'human',
  role: 'owner',
  userId: randomUUID(),
  workspaceId: randomUUID(),
  sessionId: randomUUID(),
  expiresAt: new Date(Date.now() + 60000).toISOString(),
  revoked: false,
});
const denial = (status, code) => (error) =>
  error.getStatus() === status && error.code === code;

test('missing route policy denies access even with a valid server principal', async () => {
  const f = fixture({ session: validSession(), access: 'missing' });
  await assert.rejects(
    f.guard.canActivate(f.context),
    denial(403, 'FORBIDDEN'),
  );
});
test('public routes work without a session store and never create owner authority', async () => {
  const f = fixture({ access: 'public', failure: true });
  assert.equal(await f.guard.canActivate(f.context), true);
  assert.throws(() => ownerContext(f.request), denial(403, 'FORBIDDEN'));
});
test('forged headers, body fields and request.user cannot authenticate', async () => {
  const f = fixture();
  await assert.rejects(
    f.guard.canActivate(f.context),
    denial(401, 'SESSION_REQUIRED'),
  );
  const disabled = new DisabledSessionResolver();
  assert.equal(await disabled.resolve(f.request), null);
});
test('expired, boundary-expired, revoked and malformed sessions are denied', async () => {
  for (const change of [
    { expiresAt: new Date(Date.now() - 1000).toISOString() },
    { expiresAt: new Date().toISOString() },
    { revoked: true },
    { userId: 'owner_demo' },
    { workspaceId: '../other' },
    { expiresAt: 'not-a-time' },
    { extraAuthority: true },
  ]) {
    const f = fixture({ session: { ...validSession(), ...change } });
    await assert.rejects(
      f.guard.canActivate(f.context),
      denial(401, 'SESSION_REQUIRED'),
    );
  }
});
test('agent/API-key identities and future non-owner roles cannot become a human owner', async () => {
  for (const change of [
    { actorType: 'agent' },
    { actorType: 'api-key' },
    { role: 'admin' },
    { role: 'developer' },
    { role: 'viewer' },
  ]) {
    const f = fixture({ session: { ...validSession(), ...change } });
    await assert.rejects(
      f.guard.canActivate(f.context),
      denial(403, 'FORBIDDEN'),
    );
  }
});
test('owner context comes only from the resolver, is frozen and cannot bleed across requests', async () => {
  const session = validSession();
  const f = fixture({ session });
  assert.equal(await f.guard.canActivate(f.context), true);
  const principal = ownerContext(f.request);
  assert.deepEqual(principal, {
    userId: session.userId,
    workspaceId: session.workspaceId,
    sessionId: session.sessionId,
  });
  assert.equal(Object.isFrozen(principal), true);
  assert.throws(() => ownerContext({ ...f.request }), denial(403, 'FORBIDDEN'));
  f.resolver.resolve = async () => null;
  await assert.rejects(
    f.guard.canActivate(f.context),
    denial(401, 'SESSION_REQUIRED'),
  );
  assert.throws(() => ownerContext(f.request), denial(403, 'FORBIDDEN'));
});
test('session store failures deny access with a sanitized availability error', async () => {
  const f = fixture({ failure: true });
  await assert.rejects(
    f.guard.canActivate(f.context),
    (error) =>
      denial(503, 'API_UNAVAILABLE')(error) &&
      !error.message.includes('private-session'),
  );
});
