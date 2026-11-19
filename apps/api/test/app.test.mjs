import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  ApiErrorEnvelopeSchema,
  HealthResponseSchema,
  InstallationStatusSchema,
  ReadinessResponseSchema,
  CreateProjectRequestSchema,
  CreateDomainRequestSchema,
  CreateDeploymentRequestSchema,
  PaginationQuerySchema,
} from '@cloudlane/contracts/api';
import { generateContracts } from '../../../tools/contract-generator/generate.mjs';
const { createApp } = createRequire(import.meta.url)('../dist/app.js');
const { SchemaPipe } = createRequire(import.meta.url)(
  '../dist/common/schema.pipe.js',
);
let app, origin;
before(async () => {
  app = await createApp();
  await app.listen(0, '127.0.0.1');
  origin = await app.getUrl();
});
after(async () => app?.close());
const headers = () => ({
  'Content-Type': 'application/json',
  'Idempotency-Key': randomUUID(),
});
const post = (path, body, extra = {}) =>
  fetch(`${origin}/api/v1/${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
    ...extra,
  });
async function expectError(response, status, code) {
  assert.equal(response.status, status);
  const envelope = ApiErrorEnvelopeSchema.parse(await response.json());
  assert.equal(envelope.error.code, code);
  assert.equal(envelope.error.requestId, response.headers.get('x-request-id'));
  assert.equal(response.headers.get('set-cookie'), null);
  return envelope;
}
test('liveness truthfully distinguishes an unconfigured platform from a ready one', async () => {
  const response = await fetch(`${origin}/api/v1/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
  assert.equal(
    HealthResponseSchema.parse(await response.json()).readiness,
    'unconfigured',
  );
});
test('installation status is public-safe and contains no bootstrap material', async () => {
  const response = await fetch(`${origin}/api/v1/installation/status`);
  assert.equal(
    InstallationStatusSchema.parse(await response.json()).ownerConfigured,
    false,
  );
  assert.equal(response.headers.get('set-cookie'), null);
});
test('readiness is a safe 503 while dependencies and authentication are unconfigured', async () => {
  const response = await fetch(`${origin}/api/v1/health/ready`);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(ReadinessResponseSchema.parse(await response.json()), {
    status: 'not_ready',
    database: 'unconfigured',
    authentication: 'unavailable',
  });
  assert.equal(response.headers.get('set-cookie'), null);
});
test('public owner-setup and login declarations cannot report operational success', async () => {
  for (const [path, body] of [
    ['bootstrap/claim', { code: 'private-test-claim' }],
    [
      'bootstrap/owner',
      {
        email: 'owner@example.test',
        displayName: 'Owner',
        password: 'private-test-password',
      },
    ],
    [
      'auth/login',
      { email: 'owner@example.test', password: 'private-test-password' },
    ],
  ]) {
    const error = await expectError(
      await post(path, body),
      501,
      'NOT_IMPLEMENTED',
    );
    assert.ok(!JSON.stringify(error).includes('private-test'));
  }
  await expectError(
    await fetch(`${origin}/api/v1/auth/session`),
    401,
    'SESSION_REQUIRED',
  );
});
test('all protected resource and session routes deny anonymous and forged authority', async () => {
  const id = randomUUID();
  for (const path of [
    'overview',
    'projects',
    `projects/${id}`,
    'domains',
    `deployments/${id}`,
    'auth/session',
  ]) {
    await expectError(
      await fetch(`${origin}/api/v1/${path}`, {
        headers: {
          Authorization: 'Bearer private-forged-owner',
          Cookie: '__Host-cloudlane_session=private-forged-owner',
          'X-User-Role': 'owner',
          'X-Workspace-Id': id,
        },
      }),
      401,
      'SESSION_REQUIRED',
    );
  }
  for (const [path, body] of [
    ['projects', { name: 'Example' }],
    ['domains', { name: 'example.com' }],
    ['auth/logout', {}],
    [`domains/${id}/verify`, {}],
    [`services/${id}/rollbacks`, { targetDeploymentId: id }],
  ])
    await expectError(await post(path, body), 401, 'SESSION_REQUIRED');
});
test('request validation blocks caller authority fields and keeps Add Domain one-field', async () => {
  for (const [schema, body] of [
    [
      CreateProjectRequestSchema,
      { name: 'Example', workspaceId: randomUUID() },
    ],
    [CreateProjectRequestSchema, { name: 'Example', ownerId: randomUUID() }],
    [CreateDomainRequestSchema, { name: 'example.com', dnsMode: 'managed' }],
    [CreateDomainRequestSchema, { name: 'example.com', status: 'verified' }],
  ])
    assert.throws(
      () => new SchemaPipe(schema).transform(body),
      (error) => error.getStatus() === 400 && error.code === 'VALIDATION_ERROR',
    );
  await expectError(
    await post('auth/login', {
      email: 'owner@example.test',
      password: 'private-test',
      role: 'owner',
    }),
    400,
    'VALIDATION_ERROR',
  );
});
test('body size, content type and malformed JSON have safe consistent errors', async () => {
  await expectError(
    await post('projects', { name: 'x'.repeat(17000) }),
    413,
    'PAYLOAD_TOO_LARGE',
  );
  await expectError(
    await post(
      'projects',
      {},
      { headers: { 'Content-Type': 'text/plain' }, body: 'private-test-claim' },
    ),
    415,
    'UNSUPPORTED_MEDIA_TYPE',
  );
  const error = await expectError(
    await post(
      'auth/login',
      {},
      { body: '{"password":"private-test-secret", broken' },
    ),
    400,
    'INVALID_JSON',
  );
  assert.ok(!JSON.stringify(error).includes('private-test-secret'));
});
test('anonymous callers cannot probe resource validation or bypass authorization using retry headers', async () => {
  for (const path of [
    'projects?limit=101',
    'projects?limit=2&limit=3',
    'projects?workspaceId=other',
    'projects/not-a-uuid',
  ])
    await expectError(
      await fetch(`${origin}/api/v1/${path}`),
      401,
      'SESSION_REQUIRED',
    );
  await expectError(
    await post(
      'projects',
      { name: 'Example' },
      { headers: { 'Content-Type': 'application/json' } },
    ),
    401,
    'SESSION_REQUIRED',
  );
  await expectError(
    await fetch(`${origin}/api/v1/projects?limit=20`),
    401,
    'SESSION_REQUIRED',
  );
  for (const query of [
    { limit: 101 },
    { limit: ['2', '3'] },
    { workspaceId: 'other' },
  ])
    assert.throws(() => new SchemaPipe(PaginationQuerySchema).transform(query));
});
test('deployment and routing declarations remain unavailable and reject command injection', async () => {
  const id = randomUUID(),
    path = `services/${id}/deployments`;
  await expectError(
    await post(path, { sourceUploadId: randomUUID(), framework: 'static' }),
    401,
    'SESSION_REQUIRED',
  );
  await expectError(
    await post(path, {
      sourceUploadId: randomUUID(),
      framework: 'static',
      command: 'sh -c id',
    }),
    401,
    'SESSION_REQUIRED',
  );
  await expectError(
    await post(`domains/${id}/dns-mode-transitions`, {
      targetMode: 'managed',
      expectedRevision: 1,
    }),
    401,
    'SESSION_REQUIRED',
  );
  assert.throws(() =>
    new SchemaPipe(CreateDeploymentRequestSchema).transform({
      sourceUploadId: randomUUID(),
      framework: 'static',
      command: 'sh -c id',
    }),
  );
});
test('unknown routes return JSON errors and request IDs are server-owned', async () => {
  const response = await fetch(`${origin}/api/v1/nonexistent`, {
    headers: { 'X-Request-Id': 'private-test-secret' },
  });
  const error = await expectError(response, 404, 'NOT_FOUND');
  assert.notEqual(error.error.requestId, 'private-test-secret');
});
test('OpenAPI is valid, matches generated artifacts and labels unavailable endpoints', async () => {
  const document = await generateContracts({ check: true });
  const response = await fetch(`${origin}/api/v1/openapi.json`);
  assert.equal(response.status, 200);
  const live = await response.json();
  assert.deepEqual(live, JSON.parse(JSON.stringify(document)));
  assert.equal(
    document.paths['/api/v1/health'].get['x-cloudlane-implementation'],
    'implemented',
  );
  assert.equal(
    document.paths['/api/v1/projects'].post['x-cloudlane-implementation'],
    'unavailable',
  );
  assert.ok(document.paths['/api/v1/projects'].post.responses['501']);
  assert.ok(document.paths['/api/v1/projects'].post.responses['401']);
  assert.deepEqual(document.paths['/api/v1/projects'].post.security, [
    { ownerSession: [] },
  ]);
  assert.equal(
    document.paths['/api/v1/health'].get['x-cloudlane-access'],
    'public',
  );
  for (const [path, item] of Object.entries(document.paths))
    for (const method of ['get', 'post'])
      if (item[method]) {
        assert.ok(
          ['public', 'owner'].includes(item[method]['x-cloudlane-access']),
          `${method} ${path} lacks an explicit policy`,
        );
        if (item[method]['x-cloudlane-access'] === 'owner')
          assert.ok(item[method].responses['401']);
      }
  assert.deepEqual(
    Object.keys(document.components.schemas.CreateDomainRequest.properties),
    ['name'],
  );
});
test('the local API documentation is readable with request submission disabled', async () => {
  const response = await fetch(`${origin}/api/v1/docs`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Cloudlane API/);
});
