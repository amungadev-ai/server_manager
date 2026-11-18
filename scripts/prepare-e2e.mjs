import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// Controlled build outputs only. No browser or preview server is launched here.
const directory = resolve('test-results/e2e-site');
mkdirSync(directory, { recursive: true });
for (const [mode, script] of [
  ['http', 'build'],
  ['demo', 'build:preview'],
]) {
  if (mode === 'http' && process.argv.includes('--http-ready'))
    execFileSync(process.execPath, ['scripts/verify_static.mjs', 'http'], {
      stdio: 'inherit',
    });
  else execFileSync('npm', ['run', script], { stdio: 'inherit' });
  if (!existsSync('dist/index.html'))
    throw new Error('Static build is missing its SPA fallback.');
  rmSync(resolve(directory, mode), { force: true, recursive: true });
  cpSync('dist', resolve(directory, mode), { recursive: true });
}
console.log(
  'PASS: prepared separate HTTP/demo static fixtures; no browser executed',
);
