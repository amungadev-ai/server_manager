# CL-004 / CL-006 verification — 2026-11-18

Historical local-only checkpoint. Hosted activation has since passed 46 unit/HTTP/gate and 20 actual browser cases, including an isolated browser-job rerun. Current evidence: [ci-hosted-checks.md](ci-hosted-checks.md). The original results below retain their original source/time scope.

Environment: Node 24.22.3, npm 11.9.0, TypeScript 6.0.3, Playwright 1.65.1 (package only; no browser installed here).

| Check | Result |
| --- | --- |
| Workflow policy / immutable official actions | PASS |
| Types, contracts, import boundaries | PASS; Svelte 0 errors/warnings |
| CI/gate/HTTP tests | PASS; 35 Node + 10 Python cases, zero failures/skips; JUnit and exit-code summaries saved |
| Progress gate negative cases | PASS; tools/config/deletion/rename/declared-task/base-ref cases |
| Browser-test TypeScript and discovery | PASS; 10 cases each for desktop/mobile, 20 total |
| Separate HTTP/demo static fixture builds | PASS; production fixture-exclusion checks pass in both modes |
| Clean-checkout reproduction | PASS; pinned dependency install, types/policy/contracts, 45 tests and 20-case discovery |
| Actual browser execution/screenshots/accessibility scan | NOT RUN |
| GitHub hosted workflow / artifact upload / protected branch | NOT RUN; no accessible target repository found |

The local preview relay is unavailable. No alternative local browser-control path was used and no browser binary was installed. Browser discovery cannot pass the required browser-evidence gate. JUnit/HTTP/gate results are separate from browser evidence. The pipeline rejects failed, cancelled/skipped prerequisites and missing/stale execution markers. It copies the actual verified fixture artifact ID into browser jobs so reruns do not guess a new attempt name.

Activation checklist: docs/CI_AND_TESTING.md. Canonical working records: tasks/progress/CL-004.md and CL-006.md.

Implementation source: `237174e33ea6100a682010ede309a948579b5ea2`. The clean-source manifest records no working-tree modifications. The subsequent handoff commit adds documentation and copies the reports; it does not change implementation or build inputs. Machine reports and their original path mapping are in `evidence/ci-local/`. Final local aggregate and clean-checkout reproduction both passed. The corrected artifact-rerun negative fixture is included in the 35 Node cases.
