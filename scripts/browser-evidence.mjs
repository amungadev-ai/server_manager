import { readFileSync } from 'node:fs';

export function assertBrowserEvidence(report, project, expected) {
  if (!report || report.status !== 'passed')
    throw new Error('Browser execution did not pass.');
  if (
    expected &&
    (report.runId !== expected.runId || report.commit !== expected.commit)
  )
    throw new Error('Browser evidence does not belong to this source/run.');
  const cases = report.cases?.filter((item) => item.project === project) ?? [];
  if (
    !cases.length ||
    cases.some((item) => item.status !== 'passed' || !item.browserVersion)
  )
    throw new Error(
      'Every required browser case must have a real browser execution marker and pass.',
    );
  return cases.length;
}
if (process.argv[1]?.endsWith('browser-evidence.mjs')) {
  const [project, path = 'test-results/e2e/browser-execution.json'] =
    process.argv.slice(2);
  if (!['desktop', 'mobile'].includes(project))
    throw new Error('Specify desktop or mobile.');
  const expected = JSON.parse(
    readFileSync('test-results/e2e/expected-run.json', 'utf8'),
  );
  const count = assertBrowserEvidence(
    JSON.parse(readFileSync(path, 'utf8')),
    project,
    expected,
  );
  console.log(`PASS: ${count} executed ${project} browser cases`);
}
