import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

export function assertDisposableDatabase(env) {
  try {
    const url = new URL(env.CLOUDLANE_TEST_DATABASE_URL);
    if (
      env.CLOUDLANE_POSTGRES_TESTS !== '1' ||
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      url.pathname !== '/cloudlane_ci' ||
      url.search ||
      url.hash ||
      !url.username ||
      !url.password
    )
      throw new Error();
  } catch {
    throw new Error(
      'PostgreSQL tests require explicit opt-in and an authenticated loopback database named cloudlane_ci. No database details are printed.',
    );
  }
}

if (process.argv[1]?.endsWith('run-postgres-tests.mjs')) {
  assertDisposableDatabase(process.env);
  mkdirSync('test-results/postgres', { recursive: true });
  mkdirSync('test-results/auth-fixture', { recursive: true, mode: 0o700 });
  const certificate = spawnSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      'test-results/auth-fixture/key.pem',
      '-out',
      'test-results/auth-fixture/cert.pem',
      '-days',
      '2',
      '-subj',
      '/CN=Cloudlane isolated review fixture',
      '-addext',
      'subjectAltName=DNS:panel.example.test,DNS:localhost,IP:127.0.0.1,IP:::1',
      '-addext',
      'extendedKeyUsage=serverAuth',
    ],
    { encoding: 'utf8', shell: false },
  );
  if (certificate.status !== 0)
    throw new Error('Could not prepare the isolated TLS test fixture.');
  const started = new Date().toISOString();
  const args = [
    '--test',
    '--test-concurrency=1',
    '--test-timeout=60000',
    '--test-reporter=spec',
    '--test-reporter=junit',
    '--test-reporter-destination=stdout',
    '--test-reporter-destination=test-results/postgres/junit.xml',
    'apps/api/test/postgres/control-plane.integration.mjs',
    'apps/api/test/postgres/owner-auth.integration.mjs',
  ];
  const code = await new Promise((done) => {
    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      shell: false,
    });
    child.once('error', () => done(1));
    child.once('close', (code) => done(code ?? 1));
  });
  writeFileSync(
    'test-results/postgres/summary.json',
    JSON.stringify(
      {
        started,
        finished: new Date().toISOString(),
        status: code === 0 ? 'passed' : 'failed',
        exitCode: code,
        source: 'disposable real PostgreSQL; no in-memory SQL substitute',
      },
      null,
      2,
    ) + '\n',
  );
  process.exitCode = code;
}
