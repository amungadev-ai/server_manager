import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { assertRequiredResults } from '../scripts/ci-required.mjs';
import { progressCommand } from '../scripts/ci-progress.mjs';
import { assertBrowserEvidence } from '../scripts/browser-evidence.mjs';
import { validateWorkflow } from '../scripts/validate-ci.mjs';
import { parse, stringify } from 'yaml';

test('required gate rejects failed, cancelled, skipped and missing jobs', () => {
  const passed = {
    progress: { result: 'success' },
    verify: { result: 'success' },
    postgres: { result: 'success' },
    e2e: { result: 'success' },
  };
  assert.doesNotThrow(() => assertRequiredResults(passed));
  for (const name of ['e2e', 'postgres'])
    for (const status of ['failure', 'cancelled', 'skipped', undefined])
      assert.throws(() =>
        assertRequiredResults({
          ...passed,
          [name]: status ? { result: status } : undefined,
        }),
      );
});
test('progress event selection uses validated base SHAs for PRs, merge queues and pushes', () => {
  const sha = 'a'.repeat(40);
  for (const [name, event] of [
    ['pull_request', { pull_request: { base: { sha } } }],
    ['merge_group', { merge_group: { base_sha: sha } }],
    ['push', { before: sha }],
  ])
    assert.deepEqual(progressCommand(name, event), [
      'scripts/validate_progress.py',
      '--base',
      sha,
    ]);
  assert.deepEqual(progressCommand('push', { before: '0'.repeat(40) }), [
    'scripts/validate_progress.py',
  ]);
  assert.deepEqual(progressCommand('workflow_dispatch'), [
    'scripts/validate_progress.py',
  ]);
  assert.throws(() => progressCommand('pull_request', {}));
  assert.throws(() => progressCommand('push', { before: '$(untrusted)' }));
});
test('discovery and missing browser markers cannot count as browser execution', () => {
  assert.throws(() =>
    assertBrowserEvidence({ status: 'passed', cases: [] }, 'desktop'),
  );
  assert.throws(() =>
    assertBrowserEvidence(
      {
        status: 'passed',
        cases: [{ project: 'desktop', status: 'passed', browserVersion: null }],
      },
      'desktop',
    ),
  );
  assert.throws(() =>
    assertBrowserEvidence(
      {
        status: 'failed',
        cases: [
          {
            project: 'desktop',
            status: 'failed',
            browserVersion: 'chromium-test',
          },
        ],
      },
      'desktop',
    ),
  );
  assert.equal(
    assertBrowserEvidence(
      {
        status: 'passed',
        cases: [
          {
            project: 'desktop',
            status: 'passed',
            browserVersion: 'chromium-test',
          },
        ],
      },
      'desktop',
    ),
    1,
  );
  assert.throws(() =>
    assertBrowserEvidence(
      {
        status: 'passed',
        runId: 'old-run',
        commit: 'old-source',
        cases: [
          {
            project: 'desktop',
            status: 'passed',
            browserVersion: 'chromium-test',
          },
        ],
      },
      'desktop',
      { runId: 'current-run', commit: 'current-source' },
    ),
  );
});
test('workflow validation accepts the actual policy and rejects weakened gates', () => {
  const source = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.deepEqual(validateWorkflow(source), []);
  for (const changed of [
    source.replace('contents: read', 'contents: write'),
    source.replace(
      'if: ${{ always() }}\n    needs: [progress, verify, postgres, e2e]',
      'if: ${{ success() }}\n    needs: [progress, verify, postgres, e2e]',
    ),
    source.replace('project: [desktop, mobile]', 'project: [desktop]'),
    source.replace(
      'scripts/browser-evidence.mjs',
      'scripts/removed-evidence-check.mjs',
    ),
  ])
    assert.ok(validateWorkflow(changed).length > 0);
});

test('CI command capture preserves nonzero status and records a failed step', (t) => {
  const parent = resolve('.sites-runtime/test-fixtures');
  mkdirSync(parent, { recursive: true });
  const directory = mkdtempSync(resolve(parent, 'ci-command-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const result = spawnSync(
    process.execPath,
    [
      resolve('scripts/ci-step.mjs'),
      'expected-failure',
      process.execPath,
      '-e',
      'process.exit(7)',
    ],
    { cwd: directory, encoding: 'utf8' },
  );
  assert.equal(result.status, 7);
  const records = JSON.parse(
    readFileSync(resolve(directory, 'test-results/ci/steps.json'), 'utf8'),
  );
  assert.equal(records[0].status, 'failed');
  assert.equal(records[0].exitCode, 7);
});

test('browser job reruns retain the verified artifact identity', () => {
  const source = readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.deepEqual(validateWorkflow(source), []);
  const workflow = parse(source);
  const download = workflow.jobs.e2e.steps.find((step) =>
    step.uses?.startsWith('actions/download-artifact@'),
  );
  delete download.with['artifact-ids'];
  download.with.name = 'e2e-static-${{ github.run_attempt }}';
  assert.ok(
    validateWorkflow(stringify(workflow)).some((error) =>
      error.includes('verified artifact ID'),
    ),
  );
});

test('fixture upload rejects download-only inputs and missing names or output IDs', () => {
  const source = readFileSync('.github/workflows/ci.yml', 'utf8');
  for (const mutate of [
    (step) => delete step.with.name,
    (step) => (step.with['artifact-ids'] = '123'),
    (step) => (step.with['merge-multiple'] = true),
    (step) => (step.id = 'renamed_upload'),
  ]) {
    const workflow = parse(source);
    const upload = workflow.jobs.verify.steps.find(
      (step) => step.id === 'static_fixtures',
    );
    mutate(upload);
    assert.ok(validateWorkflow(stringify(workflow)).length > 0);
  }
});
