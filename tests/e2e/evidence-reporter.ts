import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { mkdirSync, writeFileSync } from 'node:fs';

type CaseEvidence = {
  id: string;
  title: string;
  project: string;
  status: string;
  retry: number;
  browserVersion: string | null;
  viewport: string | null;
  attachments: { name: string; path: string | null }[];
};
export default class EvidenceReporter implements Reporter {
  private cases = new Map<string, CaseEvidence>();
  onTestEnd(test: TestCase, result: TestResult) {
    const annotations = [...test.annotations, ...result.annotations];
    this.cases.set(test.id, {
      id: test.id,
      title: test.titlePath().join(' / '),
      project: test.parent.project()?.name ?? 'unknown',
      status: result.status,
      retry: result.retry,
      browserVersion:
        annotations.find((item) => item.type === 'browser-runtime')
          ?.description ?? null,
      viewport:
        annotations.find((item) => item.type === 'viewport')?.description ??
        null,
      attachments: result.attachments.map((item) => ({
        name: item.name,
        path: item.path ?? null,
      })),
    });
  }
  onEnd(result: FullResult) {
    mkdirSync('test-results/e2e', { recursive: true });
    writeFileSync(
      'test-results/e2e/browser-execution.json',
      JSON.stringify(
        {
          status: result.status,
          runId: process.env.CLOUDLANE_E2E_RUN_ID ?? null,
          commit: process.env.CLOUDLANE_E2E_COMMIT ?? null,
          cases: [...this.cases.values()],
        },
        null,
        2,
      ) + '\n',
    );
  }
}
