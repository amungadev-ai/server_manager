import { createHash } from 'node:crypto';
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  existsSync,
  lstatSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, relative } from 'node:path';

const label = process.argv[2] ?? 'local';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid evidence label.');
function files(path) {
  if (!existsSync(path) || lstatSync(path).isSymbolicLink()) return [];
  if (lstatSync(path).isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    files(resolve(path, entry.name)),
  );
}
let commit = 'uncommitted';
let workingTreeDirty = true;
try {
  commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
} catch {
  /* Source ZIP without Git. */
}
try {
  workingTreeDirty =
    execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()
      .length > 0;
} catch {
  /* Exported source is not a verified Git tree. */
}
const paths = [
  'test-results/ci',
  'test-results/unit',
  'test-results/postgres',
  'test-results/installer',
  'test-results/platform',
  'test-results/e2e',
  'playwright-report',
]
  .flatMap((path) => files(resolve(path)))
  .sort();
const browserFile = 'test-results/e2e/browser-execution.json';
const browser = existsSync(browserFile)
  ? JSON.parse(readFileSync(browserFile, 'utf8'))
  : null;
const manifest = {
  label,
  commit,
  workingTreeDirty,
  recordedUtc: new Date().toISOString(),
  node: process.version,
  npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(),
  lockSha256: createHash('sha256')
    .update(readFileSync('package-lock.json'))
    .digest('hex'),
  github: {
    runId: process.env.GITHUB_RUN_ID ?? null,
    attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    event: process.env.GITHUB_EVENT_NAME ?? null,
  },
  browser: {
    execution: browser?.cases?.some((item) => item.browserVersion)
      ? 'executed'
      : 'not-run',
    reportStatus: browser?.status ?? 'missing',
  },
  files: paths.map((path) => ({
    path: relative('.', path),
    bytes: lstatSync(path).size,
    sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
  })),
};
mkdirSync('test-results/manifests', { recursive: true });
writeFileSync(
  `test-results/manifests/${label}.json`,
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(
  `Recorded ${label} evidence; browser execution: ${manifest.browser.execution}`,
);
