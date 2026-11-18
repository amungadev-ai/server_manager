import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  CreateDomainRequestSchema,
  CreateProjectRequestSchema,
  PaginationQuerySchema,
  CreateDeploymentRequestSchema,
} from '@cloudlane/contracts/api';
import { ResourceIdSchema } from '@cloudlane/contracts';
import { AgentCommandSchema } from '@cloudlane/contracts/agent';

test('resource IDs reject demo identifiers, nil values and non-v4 UUIDs', () => {
  assert.equal(ResourceIdSchema.parse(randomUUID()).length, 36);
  for (const input of [
    'proj_demo',
    '../host',
    '00000000-0000-0000-0000-000000000000',
    '018c6cd9-6c22-7abc-8abc-123456789012',
  ])
    assert.equal(ResourceIdSchema.safeParse(input).success, false);
});
test('create-project accepts bounded data but never caller workspace/owner authority', () => {
  assert.deepEqual(CreateProjectRequestSchema.parse({ name: ' My project ' }), {
    name: 'My project',
  });
  for (const extra of [
    { workspaceId: randomUUID() },
    { ownerId: randomUUID() },
    { role: 'owner' },
    { id: randomUUID() },
  ])
    assert.equal(
      CreateProjectRequestSchema.safeParse({ name: 'My project', ...extra })
        .success,
      false,
    );
  assert.equal(
    CreateProjectRequestSchema.safeParse({ name: 'a'.repeat(81) }).success,
    false,
  );
});
test('Add Domain is exactly one field, with no mode or verification shortcut', () => {
  assert.deepEqual(CreateDomainRequestSchema.parse({ name: ' EXAMPLE.COM ' }), {
    name: 'example.com',
  });
  for (const name of [
    'https://example.com',
    '*.example.com',
    '127.0.0.1',
    '-bad.example',
    'foo..example',
    'example.com/path',
  ])
    assert.equal(
      CreateDomainRequestSchema.safeParse({ name }).success,
      false,
      name,
    );
  for (const extra of [
    { dnsMode: 'managed' },
    { status: 'verified' },
    { workspaceId: randomUUID() },
  ])
    assert.equal(
      CreateDomainRequestSchema.safeParse({ name: 'example.com', ...extra })
        .success,
      false,
    );
});
test('pagination limits and opaque cursor syntax are bounded', () => {
  assert.deepEqual(PaginationQuerySchema.parse({}), { limit: 20 });
  assert.deepEqual(
    PaginationQuerySchema.parse({ limit: '25', cursor: 'opaque_cursor-1' }),
    { limit: 25, cursor: 'opaque_cursor-1' },
  );
  for (const input of [
    { limit: 0 },
    { limit: 101 },
    { limit: '1.5' },
    { limit: ['1', '2'] },
    { cursor: 'a'.repeat(513) },
    { workspaceId: randomUUID() },
  ])
    assert.equal(PaginationQuerySchema.safeParse(input).success, false);
});
test('static deployment requests cannot inject a host command or container options', () => {
  const input = { sourceUploadId: randomUUID(), framework: 'static' };
  assert.equal(CreateDeploymentRequestSchema.safeParse(input).success, true);
  for (const extra of [
    { command: 'sh -c whoami' },
    { privileged: true },
    { hostPath: '/' },
  ])
    assert.equal(
      CreateDeploymentRequestSchema.safeParse({ ...input, ...extra }).success,
      false,
    );
});
function command() {
  return {
    commandVersion: 1,
    commandId: randomUUID(),
    workspaceId: randomUUID(),
    serverId: randomUUID(),
    resourceId: randomUUID(),
    desiredGeneration: 1,
    idempotencyKey: randomUUID(),
    issuedAt: '2026-11-18T10:00:00Z',
    expiresAt: '2026-11-18T10:01:00Z',
    authorization: {
      scheme: 'test-placeholder',
      keyId: randomUUID(),
      proof: 'x'.repeat(86),
    },
    operation: 'release.startCandidate',
    payload: {
      deploymentId: randomUUID(),
      imageDigest: 'sha256:' + 'a'.repeat(64),
      internalPort: 8080,
      limits: { memoryMb: 160, cpuMilli: 250, pids: 64 },
      volumes: [],
    },
  };
}
test('agent structure accepts a typed candidate, without claiming signature/expiry/ownership verification', () => {
  assert.equal(AgentCommandSchema.safeParse(command()).success, true);
});
test('agent contract rejects generic operations, unsafe mounts, injected fields and inverted timestamps', () => {
  const input = command();
  const bad = [
    { ...input, operation: 'host.exec' },
    { ...input, commandVersion: 2 },
    { ...input, payload: { ...input.payload, command: 'sh -c id' } },
    {
      ...input,
      payload: {
        ...input.payload,
        volumes: [
          { volumeId: randomUUID(), mountPoint: '/var/run/docker.sock' },
        ],
      },
    },
    {
      ...input,
      payload: {
        ...input.payload,
        volumes: [
          { volumeId: randomUUID(), mountPoint: '/data', hostPath: '/' },
        ],
      },
    },
    { ...input, payload: { ...input.payload, imageDigest: 'latest' } },
    { ...input, expiresAt: input.issuedAt },
  ];
  for (const value of bad)
    assert.equal(AgentCommandSchema.safeParse(value).success, false);
});
