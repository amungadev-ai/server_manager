import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

mkdirSync('test-results/unit', { recursive: true });
const files = ['apps/api/test', 'tests', 'packages/contracts/test'].flatMap(
  (directory) =>
    readdirSync(directory)
      .filter((name) => name.endsWith('.test.mjs'))
      .sort()
      .map((name) => `${directory}/${name}`),
);
if (!files.length) throw new Error('An empty unit suite cannot satisfy CI.');
const commands = [
  [
    process.execPath,
    '--test',
    '--test-reporter=spec',
    '--test-reporter=junit',
    '--test-reporter-destination=stdout',
    '--test-reporter-destination=test-results/unit/node-junit.xml',
    ...files,
  ],
  ['python3', 'tests/run_python_tests.py'],
];
const results = [];
for (const [command, ...args] of commands) {
  const started = new Date().toISOString();
  const code = await new Promise((done) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.once('error', () => done(1));
    child.once('close', (code) => done(code ?? 1));
  });
  results.push({
    command: [command, ...args],
    status: code === 0 ? 'passed' : 'failed',
    exitCode: code,
    started,
    finished: new Date().toISOString(),
  });
}
writeFileSync(
  resolve('test-results/unit/summary.json'),
  JSON.stringify(results, null, 2) + '\n',
);
process.exitCode = results.some((result) => result.exitCode !== 0) ? 1 : 0;
