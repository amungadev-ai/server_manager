import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertReviewIntegration } from '../scripts/run-platform-integration.mjs';

test('live installer integration needs explicit local non-root Linux opt-in', () => {
  assert.doesNotThrow(() =>
    assertReviewIntegration(
      { CLOUDLANE_INSTALLER_STACK_TESTS: '1' },
      1001,
      'linux',
    ),
  );
  for (const [env, uid, platform] of [
    [{}, 1001, 'linux'],
    [{ CLOUDLANE_INSTALLER_STACK_TESTS: '1' }, 0, 'linux'],
    [{ CLOUDLANE_INSTALLER_STACK_TESTS: '1' }, 1001, 'darwin'],
  ])
    assert.throws(() => assertReviewIntegration(env, uid, platform));
});
