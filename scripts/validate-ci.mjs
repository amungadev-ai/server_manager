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
  for (const job of ['progress', 'verify', 'e2e', 'required'])
    fail(!!jobs[job], `Missing ${job} job`);
  fail(
    jobs.required?.if === '${{ always() }}',
    'Required gate must always run',
  );
  fail(
    ['progress', 'verify', 'e2e'].every((name) =>
      jobs.required?.needs?.includes(name),
    ),
    'Required gate must depend on every required job',
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
