import { readFileSync } from 'node:fs';
import { parseDocument } from 'yaml';

export function validateWorkflow(source) {
  const document = parseDocument(source, { uniqueKeys: true });
  if (document.errors.length)
    return document.errors.map((error) => error.message);
  const workflow = document.toJS();
  const errors = [];
  const fail = (condition, message) => {
    if (!condition) errors.push(message);
  };
  const events = Object.keys(workflow.on ?? {});
  for (const event of [
    'push',
    'pull_request',
    'merge_group',
    'workflow_dispatch',
  ])
    fail(events.includes(event), `Missing ${event} trigger`);
  fail(
    !events.includes('pull_request_target') && !events.includes('workflow_run'),
    'Privileged triggers are not allowed',
  );
  for (const event of ['push', 'pull_request'])
    fail(
      !workflow.on?.[event]?.paths && !workflow.on?.[event]?.['paths-ignore'],
      'Required workflows cannot use path filters',
    );
  fail(
    JSON.stringify(workflow.permissions) ===
      JSON.stringify({ contents: 'read' }),
    'Workflow permissions must be contents:read only',
  );
  const jobs = workflow.jobs ?? {};
  for (const job of [
    'progress',
    'verify',
    'postgres',
    'installer',
    'platform',
    'e2e',
    'required',
  ])
    fail(!!jobs[job], `Missing ${job} job`);
  fail(
    jobs.required?.if === '${{ always() }}',
    'Required gate must always run',
  );
  fail(
    ['progress', 'verify', 'postgres', 'installer', 'platform', 'e2e'].every(
      (name) => jobs.required?.needs?.includes(name),
    ),
    'Required gate must depend on every required job',
  );
  const installerRun = jobs.installer?.steps?.find(
    (step) =>
      step.run === 'node scripts/ci-step.mjs installer npm run test:installer',
  );
  const platformRun = jobs.platform?.steps?.find(
    (step) =>
      step.run ===
      'node scripts/ci-step.mjs platform npm run test:installer-stack',
  );
  const platformGo = jobs.platform?.steps?.find((step) =>
    step.uses?.startsWith('actions/setup-go@'),
  );
  fail(
    jobs.platform?.needs === 'progress' &&
      jobs.platform?.['runs-on'] === 'ubuntu-24.04' &&
      !jobs.platform?.if &&
      !!platformRun &&
      !platformRun.if &&
      platformRun.env?.CLOUDLANE_INSTALLER_STACK_TESTS === '1' &&
      platformGo?.with?.['go-version-file'] === 'installer/.go-version' &&
      platformGo?.with?.cache === false &&
      !platformGo?.if,
    'Live platform installation requires unconditional pinned Ubuntu/Go execution and explicit disposable opt-in',
  );
  const goSetup = jobs.installer?.steps?.find((step) =>
    step.uses?.startsWith('actions/setup-go@'),
  );
  fail(
    jobs.installer?.needs === 'progress' &&
      jobs.installer?.['runs-on'] === 'ubuntu-24.04' &&
      !jobs.installer?.if &&
      !!installerRun &&
      !installerRun.if &&
      goSetup?.with?.['go-version-file'] === 'installer/.go-version' &&
      goSetup?.with?.cache === false &&
      !goSetup?.if,
    'Installer checks require unconditional Ubuntu 24.04 execution with the pinned Go version',
  );
  fail(
    JSON.stringify(jobs.e2e?.strategy?.matrix?.project) ===
      JSON.stringify(['desktop', 'mobile']),
    'Browser matrix must include desktop/mobile',
  );
  fail(
    jobs.e2e?.strategy?.['fail-fast'] === false,
    'Both browser projects must collect their results',
  );
  fail(
    /^postgres:18\.1@sha256:[a-f0-9]{64}$/.test(
      jobs.postgres?.services?.postgres?.image ?? '',
    ),
    'PostgreSQL tests require a versioned, digest-pinned real database service',
  );
  fail(
    jobs.postgres?.needs === 'progress' && !jobs.postgres?.if,
    'PostgreSQL integration must run after progress without an optional condition',
  );
  const databaseTest = jobs.postgres?.steps?.find(
    (step) =>
      step.run === 'node scripts/ci-step.mjs postgres npm run test:postgres',
  );
  fail(
    databaseTest?.env?.CLOUDLANE_POSTGRES_TESTS === '1' &&
      databaseTest?.env?.CLOUDLANE_TEST_DATABASE_URL?.endsWith(
        '@127.0.0.1:5432/cloudlane_ci',
      ) &&
      !databaseTest?.if,
    'Real PostgreSQL tests require explicit disposable-database opt-in and cannot be skipped',
  );
  fail(
    jobs.verify?.outputs?.fixture_artifact_id ===
      '${{ steps.static_fixtures.outputs.artifact-id }}',
    'Verification must expose the actual static fixture artifact ID',
  );
  const fixtureUpload = jobs.verify?.steps?.find(
    (step) => step.id === 'static_fixtures',
  );
  fail(
    fixtureUpload?.uses?.startsWith('actions/upload-artifact@') &&
      fixtureUpload?.with?.path === 'test-results/e2e-site/',
    'Static fixture output must resolve to the actual upload step',
  );
  const download = jobs.e2e?.steps?.find((step) =>
    step.uses?.startsWith('actions/download-artifact@'),
  );
  fail(
    download?.with?.['artifact-ids'] ===
      '${{ needs.verify.outputs.fixture_artifact_id }}' &&
      download?.with?.['merge-multiple'] === true,
    'Browser reruns must download the verified artifact ID, not guess the current attempt name',
  );
  let browserEvidence = false,
    progressGate = false;
  for (const [name, job] of Object.entries(jobs)) {
    fail(
      Number.isInteger(job['timeout-minutes']) && job['timeout-minutes'] <= 30,
      `${name}: bounded timeout required`,
    );
    fail(
      !job.permissions ||
        JSON.stringify(job.permissions) ===
          JSON.stringify({ contents: 'read' }),
      `${name}: elevated job permissions forbidden`,
    );
    fail(
      job['continue-on-error'] !== true,
      `${name}: required jobs cannot ignore errors`,
    );
    for (const step of job.steps ?? []) {
      fail(
        step['continue-on-error'] !== true,
        `${name}: required steps cannot ignore errors`,
      );
      if (step.uses) {
        fail(
          /^actions\/[a-z-]+@[a-f0-9]{40}$/.test(step.uses),
          `${name}: pin trusted actions to an immutable commit`,
        );
        if (step.uses.startsWith('actions/checkout@'))
          fail(
            step.with?.['persist-credentials'] === false,
            `${name}: checkout credentials cannot persist`,
          );
        if (step.uses.startsWith('actions/upload-artifact@')) {
          fail(
            typeof step.with?.name === 'string' &&
              step.with.name.includes('${{ github.run_attempt }}') &&
              !('artifact-ids' in step.with) &&
              !('merge-multiple' in step.with),
            `${name}: uploads require an explicit attempt name and upload action inputs`,
          );
          fail(
            step.if === '${{ always() }}' ||
              step.name === 'Upload static browser fixtures',
            `${name}: test evidence must upload on failure`,
          );
          fail(
            step.with?.['retention-days'] === 7 &&
              step.with?.['include-hidden-files'] === false &&
              step.with?.['if-no-files-found'] === 'error',
            `${name}: explicit bounded evidence retention required`,
          );
          fail(
            !String(step.with?.path)
              .split('\n')
              .some(
                (path) =>
                  path === '.' || path.includes('**') || path.includes('.env'),
              ),
            `${name}: artifact paths must be an evidence allowlist`,
          );
        }
      }
      if (step.run?.includes('browser-evidence.mjs')) browserEvidence = true;
      if (step.run?.includes('ci-progress.mjs')) progressGate = true;
      fail(
        !step.run?.includes('${{'),
        `${name}: pass event values via environment rather than shell interpolation`,
      );
    }
  }
  fail(browserEvidence, 'Browser execution markers must be required');
  fail(progressGate, 'Committed progress gate is required');
  return errors;
}
if (process.argv[1]?.endsWith('validate-ci.mjs')) {
  const errors = validateWorkflow(
    readFileSync('.github/workflows/ci.yml', 'utf8'),
  );
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else
    console.log(
      'PASS: CI triggers, gates, pinned actions, browser matrix and evidence policy',
    );
}
