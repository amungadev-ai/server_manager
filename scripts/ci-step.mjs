import { spawn } from 'node:child_process';
import {
  createWriteStream,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { resolve } from 'node:path';

const [label, command, ...args] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(label ?? '') || !command)
  throw new Error('Use ci-step.mjs <label> <executable> [literal arguments]');
const directory = resolve('test-results/ci');
mkdirSync(directory, { recursive: true });
const started = new Date().toISOString();
const output = createWriteStream(resolve(directory, `${label}.log`));
const child = spawn(command, args, {
  shell: false,
  env: { ...process.env, NO_COLOR: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (chunk) => {
  output.write(chunk);
  process.stdout.write(chunk);
});
child.stderr.on('data', (chunk) => {
  output.write(chunk);
  process.stderr.write(chunk);
});
child.on('error', (error) =>
  output.write(
    `Could not start the declared command: ${error.code ?? 'unknown'}\n`,
  ),
);
const code = await new Promise((resolveCode) =>
  child.on('close', (code) => resolveCode(code ?? 1)),
);
await new Promise((resolveEnd) => output.end(resolveEnd));
const statusFile = resolve(directory, 'steps.json');
const records = existsSync(statusFile)
  ? JSON.parse(readFileSync(statusFile, 'utf8'))
  : [];
records.push({
  label,
  command: [command, ...args],
  started,
  finished: new Date().toISOString(),
  status: code === 0 ? 'passed' : 'failed',
  exitCode: code,
});
writeFileSync(statusFile, JSON.stringify(records, null, 2) + '\n');
process.exitCode = code;
