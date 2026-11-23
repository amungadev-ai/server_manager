import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  projectCursor,
  readProjectCursor,
} = require('../dist/projects/cursor.js');
const { ProjectStore } = require('../dist/projects/store.js');
const { AuthStore } = require('../dist/auth/store.js');
test('project cursor is a strict canonical position marker, never a workspace override', () => {
  const workspace = randomUUID(),
    after = randomUUID(),
    cursor = projectCursor(workspace, after);
  assert.equal(readProjectCursor(cursor, workspace), after);
  assert.equal(readProjectCursor(undefined, workspace), null);
  for (const value of [
    '',
    cursor + '=',
    cursor + '/',
    'a'.repeat(513),
    Buffer.from('invalid').toString('base64url'),
    Buffer.from(
      JSON.stringify({ v: 2, workspaceId: workspace, after }),
    ).toString('base64url'),
    Buffer.from(
      JSON.stringify({ v: 1, workspaceId: workspace, after, role: 'owner' }),
    ).toString('base64url'),
  ])
    assert.throws(
      () => readProjectCursor(value, workspace),
      (e) => e.code === 'VALIDATION_ERROR',
    );
  assert.throws(
    () => readProjectCursor(cursor, randomUUID()),
    (e) => e.code === 'VALIDATION_ERROR',
  );
});
test('project store fails closed and redacts an unavailable connection before any query can run', async () => {
  const store = new ProjectStore(
    new AuthStore({
      connect: async () => {
        throw new Error('private-database-password');
      },
    }),
  );
  const ctx = {
    userId: randomUUID(),
    workspaceId: randomUUID(),
    sessionId: randomUUID(),
  };
  for (const operation of [
    () => store.create(ctx, { name: 'Project' }, randomUUID(), randomUUID()),
    () => store.list(ctx, { limit: 20 }),
    () => store.get(ctx, randomUUID()),
    () => store.overview(ctx),
  ])
    await assert.rejects(
      operation,
      (e) =>
        e.code === 'API_UNAVAILABLE' &&
        e.getStatus() === 503 &&
        !e.message.includes('private-database-password'),
    );
});
