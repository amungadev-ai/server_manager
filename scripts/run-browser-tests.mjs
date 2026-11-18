import { randomUUID } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const discovery = args.includes('--list');
const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
// Only disposable, ignored test outputs are cleared; stale evidence cannot pass a new run.
rmSync('test-results/e2e', { recursive: true, force: true });
rmSync('playwright-report', { recursive: true, force: true });
mkdirSync('test-results/e2e', { recursive: true });
const runId = randomUUID();
let commit = 'uncommitted';
try {
  commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
} catch {
  /* Exported source. */
}
if (!discovery)
  writeFileSync(
    'test-results/e2e/expected-run.json',
    JSON.stringify({ runId, commit, startedUtc: new Date().toISOString() }) +
      '\n',
  );
const child = spawn(process.execPath, [cli, 'test', ...args], {
  shell: false,
  stdio: 'inherit',
  env: {
    ...process.env,
    CLOUDLANE_E2E_RUN_ID: runId,
    CLOUDLANE_E2E_COMMIT: commit,
  },
});
const code = await new Promise((done) => {
  child.once('error', () => done(1));
  child.once('close', (code) => done(code ?? 1));
});
if (discovery)
  writeFileSync(
    'test-results/e2e/discovery.json',
    JSON.stringify(
      {
        status: code === 0 ? 'discovered' : 'failed',
        browserExecution: 'not-run',
        commit,
        recordedUtc: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );
process.exitCode = code;
