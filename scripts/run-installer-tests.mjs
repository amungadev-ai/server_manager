import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, resolve } from 'node:path';

const root = resolve('test-results/installer');
mkdirSync(root, { recursive: true });
const go = process.env.CLOUDLANE_GO ?? 'go';
const gofmt = isAbsolute(go) ? resolve(dirname(go), 'gofmt') : 'gofmt';
const version = readFileSync('installer/.go-version', 'utf8').trim();
const steps = [];
const env = {
  ...process.env,
  GOTOOLCHAIN: 'local',
  GOPROXY: 'off',
  GOSUMDB: 'off',
};
function run(label, command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 240_000,
    maxBuffer: 16 * 1024 * 1024,
    env,
    ...options,
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  writeFileSync(resolve(root, `${label}.log`), stdout + stderr);
  const passed =
    !result.error && (options.accepted ?? [0]).includes(result.status);
  steps.push({ label, exitCode: result.status, passed });
  if (!passed) throw new Error(`${label} failed\n${stdout}\n${stderr}`);
  return stdout;
}
const hash = (path) =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
try {
  const actualVersion = run('toolchain', go, ['version']).trim();
  if (!actualVersion.startsWith(`go version go${version} linux/amd64`))
    throw new Error(
      'Installer checks require the pinned Linux amd64 Go toolchain.',
    );
  if (run('format', gofmt, ['-l', 'installer']).trim())
    throw new Error('Go formatting differs.');
  const output = run('tests', go, [
    '-C',
    'installer',
    'test',
    '-race',
    '-count=1',
    '-timeout=120s',
    '-coverprofile=../test-results/installer/coverage.out',
    '-json',
    './...',
  ]);
  const events = output
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const passed = events.filter(
    (event) => event.Action === 'pass' && event.Test,
  );
  const packages = events.filter(
    (event) => event.Action === 'pass' && !event.Test,
  );
  if (
    !passed.length ||
    packages.length !== 3 ||
    events.some((event) => ['fail', 'skip'].includes(event.Action))
  )
    throw new Error('Missing, failed or skipped installer test execution.');
  run('vet', go, ['-C', 'installer', 'vet', './...']);
  const artifact = resolve(root, 'cloudlane-installer_0.0.0_linux_amd64');
  const repeat = resolve(root, 'repeat-build');
  for (const [label, path] of [
    ['build', artifact],
    ['repeat-build', repeat],
  ])
    run(
      label,
      go,
      [
        '-C',
        'installer',
        'build',
        '-trimpath',
        '-buildvcs=false',
        '-ldflags=-buildid=',
        '-o',
        path,
        './cmd/cloudlane-installer',
      ],
      { env: { ...env, CGO_ENABLED: '0', GOOS: 'linux', GOARCH: 'amd64' } },
    );
  if (hash(artifact) !== hash(repeat))
    throw new Error('Repeated builds produced different bytes.');
  rmSync(repeat);
  const host = run(
    'host-preflight',
    artifact,
    ['preflight', '--format', 'json'],
    {
      accepted: [0, 2],
    },
  );
  const report = JSON.parse(host);
  if (
    report.schema !== 'cloudlane.preflight.v1' ||
    report.ready_to_install !== false ||
    !['blocked', 'incomplete'].includes(report.status) ||
    !report.checks.some((check) => check.status === 'deferred')
  )
    throw new Error(
      'Host diagnostic overstated readiness or omitted deferred checks.',
    );
  writeFileSync(resolve(root, 'host-preflight.json'), host);
  const summary = {
    scope: 'development-only; no host installation or production signing',
    toolchain: actualVersion,
    topLevelTests: passed.filter((event) => !event.Test.includes('/')).length,
    subtests: passed.filter((event) => event.Test.includes('/')).length,
    skipped: 0,
    packages: packages.map((event) => event.Package),
    raceDetector: true,
    vet: 'passed',
    repeatedBuild: 'byte-identical',
    artifactSHA256: hash(artifact),
    hostStatus: report.status,
    readyToInstall: false,
  };
  writeFileSync(
    resolve(root, 'summary.json'),
    JSON.stringify(summary, null, 2) + '\n',
  );
  console.log(JSON.stringify(summary));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  writeFileSync(
    resolve(root, 'steps.json'),
    JSON.stringify(steps, null, 2) + '\n',
  );
}
