import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function assertReviewIntegration(env, uid, platform) {
  if (
    env.CLOUDLANE_INSTALLER_STACK_TESTS !== '1' ||
    uid === 0 ||
    platform !== 'linux'
  )
    throw new Error(
      'Live installer tests require explicit non-root Linux disposable-Docker opt-in.',
    );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  assertReviewIntegration(process.env, process.getuid?.(), process.platform);
  const reports = resolve('test-results/platform');
  const bundle = resolve('test-results/platform-bundle');
  const privateRoot = resolve('.sites-runtime/platform-integration');
  mkdirSync(reports, { recursive: true });
  mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
  const config = resolve(privateRoot, 'docker-client');
  mkdirSync(config, { recursive: true, mode: 0o700 });
  const go = process.env.CLOUDLANE_GO ?? 'go';
  const dockerEnv = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('DOCKER_')),
  );
  const steps = [];
  const run = (label, command, args, options = {}) => {
    const r = spawnSync(command, args, {
      encoding: 'utf8',
      timeout: 600_000,
      maxBuffer: 32 * 1024 * 1024,
      ...options,
    });
    writeFileSync(
      resolve(reports, `${label}.log`),
      (r.stdout ?? '') + (r.stderr ?? ''),
    );
    steps.push({
      label,
      passed: !r.error && r.status === 0,
      exitCode: r.status,
    });
    if (r.error || r.status !== 0)
      throw new Error(`${label} failed; inspect its bounded CI log.`);
    return r.stdout.trim();
  };
  const docker = (label, args) =>
    run(
      label,
      '/usr/bin/docker',
      ['--host=unix:///var/run/docker.sock', `--config=${config}`, ...args],
      { env: dockerEnv },
    );
  try {
    const version = readFileSync('installer/.go-version', 'utf8').trim();
    if (
      !run('go-version', go, ['version']).startsWith(
        `go version go${version} linux/amd64`,
      )
    )
      throw new Error('Pinned Go toolchain required.');
    docker('docker-version', ['version', '--format', '{{.Server.Version}}']);
    run('http-build', 'npm', ['run', 'build']);
    rmSync(bundle, { recursive: true, force: true });
    for (const dir of ['api/apps/api', 'api/packages/contracts', 'dashboard'])
      mkdirSync(resolve(bundle, dir), { recursive: true });
    for (const name of ['package.json', 'package-lock.json'])
      cpSync(name, resolve(bundle, 'api', name));
    for (const [from, to] of [
      ['apps/api/package.json', 'api/apps/api/package.json'],
      ['apps/api/dist', 'api/apps/api/dist'],
      ['apps/api/migrations', 'api/apps/api/migrations'],
      [
        'packages/contracts/package.json',
        'api/packages/contracts/package.json',
      ],
      ['packages/contracts/dist', 'api/packages/contracts/dist'],
      ['dist', 'dashboard'],
      ['deploy/Caddyfile.internal', 'Caddyfile'],
    ])
      cpSync(from, resolve(bundle, to), {
        recursive: true,
        verbatimSymlinks: true,
      });
    run(
      'prebuilt-runtime-dependencies',
      'npm',
      [
        'ci',
        '--omit=dev',
        '--workspace=@cloudlane/api',
        '--workspace=@cloudlane/contracts',
        '--ignore-scripts',
        '--no-audit',
      ],
      { cwd: resolve(bundle, 'api') },
    );
    const sources = {
      node: readFileSync('deploy/images/api.Dockerfile', 'utf8').match(
        /^FROM (\S+)/m,
      )[1],
      caddy: readFileSync('deploy/images/caddy.Dockerfile', 'utf8').match(
        /^FROM (\S+)/m,
      )[1],
      postgres:
        'postgres:18.7@sha256:c699303802144847d238196173655dbbecf7a96aeca1565f2b02eb671a1f0b6b',
    };
    for (const [name, ref] of Object.entries(sources)) {
      if (!/@sha256:[a-f0-9]{64}$/.test(ref))
        throw new Error('Mutable base image forbidden.');
      docker(`pull-${name}`, ['image', 'pull', ref]);
    }
    const commit = run('source', 'git', ['rev-parse', 'HEAD']);
    for (const component of ['api', 'caddy'])
      docker(`build-${component}`, [
        'build',
        '--network=none',
        '--label',
        `com.cloudlane.source=${commit}`,
        '--iidfile',
        resolve(privateRoot, `${component}.iid`),
        '-f',
        resolve(`deploy/images/${component}.Dockerfile`),
        bundle,
      ]);
    const require = createRequire(import.meta.url);
    const { loadMigrations, migrationChecksum } = require(
      resolve('apps/api/dist/database/migrations.js'),
    );
    const schemaDigest = createHash('sha256')
      .update(
        loadMigrations()
          .map((m) => `${m.id}:${migrationChecksum(m.sql)}\n`)
          .join(''),
      )
      .digest('hex');
    const now = Date.now();
    const testPlan = {
      schema: 1,
      product: 'cloudlane-platform-review',
      version: '0.1.0',
      platform: 'linux-amd64',
      database_image: sources.postgres,
      api_image: readFileSync(resolve(privateRoot, 'api.iid'), 'utf8').trim(),
      caddy_image: readFileSync(
        resolve(privateRoot, 'caddy.iid'),
        'utf8',
      ).trim(),
      schema_sha256: schemaDigest,
      issued_at: new Date(now - 60_000)
        .toISOString()
        .replace('.000Z', 'Z')
        .replace(/\.\d{3}Z$/, 'Z'),
      expires_at: new Date(now + 3_600_000)
        .toISOString()
        .replace(/\.\d{3}Z$/, 'Z'),
    };
    const path = resolve(privateRoot, 'test-plan.json');
    writeFileSync(path, JSON.stringify(testPlan) + '\n', { mode: 0o600 });
    writeFileSync(
      resolve(reports, 'images.json'),
      JSON.stringify(
        {
          source: commit,
          baseImages: sources,
          plan: testPlan,
          signing: 'ephemeral Go test key; no production release',
        },
        null,
        2,
      ) + '\n',
    );
    const binary = resolve(privateRoot, 'cloudlane-installer');
    const goEnv = {
      ...process.env,
      GOTOOLCHAIN: 'local',
      GOPROXY: 'off',
      GOSUMDB: 'off',
    };
    run(
      'installer-binary',
      go,
      [
        '-C',
        'installer',
        'build',
        '-trimpath',
        '-buildvcs=false',
        '-o',
        binary,
        './cmd/cloudlane-installer',
      ],
      { env: { ...goEnv, CGO_ENABLED: '0' } },
    );
    const result = run(
      'live-tests',
      go,
      [
        '-C',
        'installer',
        'test',
        '-tags=integration',
        '-race',
        '-count=1',
        '-timeout=600s',
        '-run=^TestLiveReviewStack$',
        '-json',
        './internal/platform',
      ],
      {
        env: {
          ...goEnv,
          CLOUDLANE_TEST_PLATFORM_PLAN: path,
          CLOUDLANE_TEST_INSTALLER_BINARY: binary,
          CLOUDLANE_TEST_PLATFORM_REPORTS: reports,
        },
      },
    );
    const events = result.split('\n').map((line) => JSON.parse(line));
    const passed = events.filter((e) => e.Action === 'pass' && e.Test);
    if (
      !passed.some((e) => e.Test === 'TestLiveReviewStack') ||
      passed.length < 9 ||
      events.some((e) => ['skip', 'fail'].includes(e.Action))
    )
      throw new Error(
        'Actual live integration execution is missing, failed or skipped.',
      );
    const summary = {
      source: commit,
      status: 'passed',
      topLevelTests: 1,
      subtests: passed.length - 1,
      skipped: 0,
      raceDetector: true,
      actualComponents: [
        'PostgreSQL 18.7',
        'NestJS API on Node 24.22.3',
        'Caddy 2.11.9',
        'HTTP static Svelte dashboard',
      ],
      systemd: 'offline verify; no boot or host service activation',
      hostPublication: '127.0.0.1 only',
      finalState: 'awaiting_tls_and_claim',
      readyToClaim: false,
    };
    writeFileSync(
      resolve(reports, 'summary.json'),
      JSON.stringify(summary, null, 2) + '\n',
    );
    console.log(JSON.stringify(summary));
  } catch (error) {
    console.error(error.message);
    const log = readFileSync(
      resolve(reports, `${steps.at(-1)?.label}.log`),
      'utf8',
    );
    if (steps.at(-1)?.label === 'live-tests') console.error(log.slice(-18_000));
    process.exitCode = 1;
  } finally {
    writeFileSync(
      resolve(reports, 'steps.json'),
      JSON.stringify(steps, null, 2) + '\n',
    );
  }
}
