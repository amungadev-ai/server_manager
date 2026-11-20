import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  HttpInfrastructureApi,
  InfrastructureError,
} from '../apps/dashboard/src/lib/api/http.ts';
const session = () => ({
  authenticated: true,
  user: {
    id: randomUUID(),
    email: 'owner@example.test',
    displayName: 'Test owner',
    role: 'owner',
  },
  workspace: { id: randomUUID(), name: 'Test workspace' },
});
const emptySnapshot = () => ({
  projects: [],
  services: [],
  domains: [],
  activity: [],
  server: null,
});

test('HTTP requests validate a real session before fetching protected data and include cookies', async (t) => {
  const calls = [];
  const snapshot = emptySnapshot();
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    calls.push([path, options.credentials]);
    return Response.json(path.endsWith('/session') ? session() : snapshot);
  });
  assert.deepEqual(await new HttpInfrastructureApi().getSnapshot(), snapshot);
  assert.deepEqual(calls, [
    ['/api/v1/auth/session', 'include'],
    ['/api/v1/overview', 'include'],
  ]);
});
test('a rejected session does not request protected data or fall back to fixtures', async (t) => {
  const paths = [],
    requestId = randomUUID();
  t.mock.method(globalThis, 'fetch', async (path) => {
    paths.push(path);
    return Response.json(
      {
        error: {
          code: 'SESSION_REQUIRED',
          message: 'Sign in required.',
          requestId,
        },
      },
      { status: 401 },
    );
  });
  await assert.rejects(
    () => new HttpInfrastructureApi().getSnapshot(),
    (error) =>
      error instanceof InfrastructureError &&
      error.code === 'SESSION_REQUIRED' &&
      error.status === 401 &&
      error.requestId === requestId,
  );
  assert.deepEqual(paths, ['/api/v1/auth/session']);
});
test('HTML and malformed JSON are reported as invalid API responses', async (t) => {
  for (const response of [
    new Response('<html>Dashboard</html>', {
      headers: { 'Content-Type': 'text/html' },
    }),
    new Response('{ broken', {
      headers: { 'Content-Type': 'application/json' },
    }),
  ]) {
    t.mock.method(globalThis, 'fetch', async () => response);
    await assert.rejects(
      () => new HttpInfrastructureApi().getSnapshot(),
      (error) => error.code === 'INVALID_API_RESPONSE',
    );
    t.mock.restoreAll();
  }
});
test('a forged or malformed success session cannot unlock the overview request', async (t) => {
  for (const body of [
    { authenticated: true },
    { ...session(), user: { ...session().user, role: 'admin' } },
    { ...session(), token: 'must-not-be-accepted' },
  ]) {
    const paths = [];
    t.mock.method(globalThis, 'fetch', async (path) => {
      paths.push(path);
      return Response.json(body);
    });
    await assert.rejects(
      () => new HttpInfrastructureApi().getSnapshot(),
      (error) => error.code === 'INVALID_API_RESPONSE',
    );
    assert.deepEqual(paths, ['/api/v1/auth/session']);
    t.mock.restoreAll();
  }
});
test('HTTP overview data rejects synthetic IDs, unbounded metrics and unknown fields', async (t) => {
  for (const body of [
    {
      ...emptySnapshot(),
      projects: [
        { id: 'proj_demo', name: 'Demo', description: '', updatedLabel: '' },
      ],
    },
    {
      ...emptySnapshot(),
      server: {
        name: 'vps',
        os: 'Ubuntu',
        health: 'healthy',
        observedAt: '2026-11-18T10:00:00Z',
        cpuPercent: 101,
        memoryUsedMb: 50,
        memoryTotalMb: 1024,
        diskUsedGb: 1,
        diskTotalGb: 10,
      },
    },
    { ...emptySnapshot(), secret: 'must-not-appear-in-an-error' },
  ]) {
    t.mock.method(globalThis, 'fetch', async (path) =>
      Response.json(path.endsWith('/session') ? session() : body),
    );
    await assert.rejects(
      () => new HttpInfrastructureApi().getSnapshot(),
      (error) =>
        error.code === 'INVALID_API_RESPONSE' &&
        !error.message.includes('must-not-appear'),
    );
    t.mock.restoreAll();
  }
});
test('malformed server error envelopes never surface arbitrary response text', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json(
      { error: { message: 'sensitive server output', code: 'INVENTED' } },
      { status: 500 },
    ),
  );
  await assert.rejects(
    () => new HttpInfrastructureApi().getSnapshot(),
    (error) =>
      error.code === 'INVALID_API_RESPONSE' &&
      !error.message.includes('sensitive'),
  );
});
test('streamed responses are bounded even without a Content-Length header', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response('x'.repeat(1024 * 1024 + 1), {
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  await assert.rejects(
    () => new HttpInfrastructureApi().getSnapshot(),
    (error) => error.code === 'INVALID_API_RESPONSE',
  );
});
test('request cancellation propagates instead of becoming a network error', async (t) => {
  const controller = new AbortController();
  controller.abort();
  t.mock.method(globalThis, 'fetch', async (_path, options) => {
    options.signal.throwIfAborted();
  });
  await assert.rejects(
    () => new HttpInfrastructureApi().getSnapshot(controller.signal),
    (error) => error.name === 'AbortError',
  );
});

test('bounded overview accepts the full metadata contract including escaped descriptions, then cancels above 4 MiB', async (t) => {
  const snapshot = emptySnapshot();
  snapshot.projects = Array.from({ length: 1000 }, () => ({
    id: randomUUID(),
    name: 'x'.repeat(80),
    description: '\u0000'.repeat(240),
    updatedLabel: 'Updated',
  }));
  let oversized = false,
    cancelled = false;
  t.mock.method(globalThis, 'fetch', async (path) => {
    if (path.endsWith('/session')) return Response.json(session());
    if (!oversized) return Response.json(snapshot);
    return new Response(
      new ReadableStream({
        pull(controller) {
          controller.enqueue(new Uint8Array(1024 * 1024));
        },
        cancel() {
          cancelled = true;
        },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  });
  assert.deepEqual(await new HttpInfrastructureApi().getSnapshot(), snapshot);
  oversized = true;
  await assert.rejects(
    new HttpInfrastructureApi().getSnapshot(),
    (error) => error.code === 'INVALID_API_RESPONSE',
  );
  assert.equal(cancelled, true);
});
