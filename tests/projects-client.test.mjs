import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  HttpProjectApi,
  ProjectMutationError,
} from '../apps/dashboard/src/lib/api/projects.ts';
const origin = 'https://panel.example.test',
  workspace = randomUUID(),
  user = randomUUID(),
  csrf = 'A'.repeat(43);
const session = () => ({
  authenticated: true,
  mfaVerified: true,
  authenticationMethod: 'totp',
  csrfToken: csrf,
  user: {
    id: user,
    email: 'owner@example.test',
    displayName: 'Owner',
    role: 'owner',
  },
  workspace: { id: workspace, name: 'Workspace' },
});
const project = () => ({
  id: randomUUID(),
  workspaceId: workspace,
  name: 'Project',
  slug: 'project',
  description: '',
  createdAt: '2026-11-19T00:00:00.000Z',
  updatedAt: '2026-11-19T00:00:00.000Z',
});
test('project client rejects insecure/cross-origin targets and unverified sessions before mutation', async (t) => {
  assert.throws(() => new HttpProjectApi('http://localhost'));
  assert.throws(() => new HttpProjectApi(origin + '/'));
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return Response.json({ ...session(), mfaVerified: undefined });
  });
  const api = new HttpProjectApi(origin);
  await assert.rejects(
    api.create({ name: 'Project' }, randomUUID()),
    (e) => e.code === 'SESSION_REQUIRED',
  );
  assert.equal(calls, 1);
  api.dispose();
});
test('project client binds create to current MFA CSRF and retains the caller retry key across ambiguous failures', async (t) => {
  const calls = [],
    record = project(),
    response = {
      project: record,
      environment: {
        id: randomUUID(),
        projectId: record.id,
        name: 'production',
      },
    };
  let fail = true;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push([url, options]);
    if (url.endsWith('/session')) return Response.json(session());
    if (fail) {
      fail = false;
      throw new Error('connection dropped after commit');
    }
    return Response.json(response, { status: 201 });
  });
  const api = new HttpProjectApi(origin),
    key = randomUUID();
  await assert.rejects(
    api.create({ name: 'Project' }, key),
    (e) => e instanceof ProjectMutationError && e.ambiguous,
  );
  assert.deepEqual(await api.create({ name: 'Project' }, key), response);
  const writes = calls.filter(([url]) => url.endsWith('/projects'));
  assert.equal(writes.length, 2);
  for (const [, options] of writes) {
    assert.equal(options.headers['Idempotency-Key'], key);
    assert.equal(options.headers['X-CSRF-Token'], csrf);
    assert.equal(options.headers['X-Cloudlane-Request'], 'owner-auth');
    assert.equal(options.credentials, 'include');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), { name: 'Project' });
  }
  api.dispose();
  assert.equal(writes[0][1].signal.aborted, true);
});
test('project list/detail/create responses reject foreign workspace scope and mismatched environment links', async (t) => {
  const record = project();
  let body = {
    items: [{ ...record, workspaceId: randomUUID() }],
    nextCursor: null,
  };
  t.mock.method(globalThis, 'fetch', async (url) =>
    Response.json(url.endsWith('/session') ? session() : body),
  );
  const api = new HttpProjectApi(origin);
  await assert.rejects(api.list(), (e) => e.code === 'INVALID_API_RESPONSE');
  body = { ...record, workspaceId: randomUUID() };
  await assert.rejects(
    api.get(record.id),
    (e) => e.code === 'INVALID_API_RESPONSE',
  );
  body = {
    project: record,
    environment: {
      id: randomUUID(),
      projectId: randomUUID(),
      name: 'production',
    },
  };
  await assert.rejects(
    api.create({ name: 'Project' }, randomUUID()),
    (e) => e instanceof ProjectMutationError && e.ambiguous,
  );
  api.dispose();
});
test('project errors never echo raw response text and definitive conflicts are not ambiguous', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) =>
    url.endsWith('/session')
      ? Response.json(session())
      : Response.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'private-query-secret',
              requestId: randomUUID(),
            },
          },
          { status: 409 },
        ),
  );
  const api = new HttpProjectApi(origin);
  await assert.rejects(
    api.create({ name: 'Project' }, randomUUID()),
    (e) =>
      e instanceof ProjectMutationError &&
      !e.ambiguous &&
      !e.message.includes('private-query-secret'),
  );
  api.dispose();
});
