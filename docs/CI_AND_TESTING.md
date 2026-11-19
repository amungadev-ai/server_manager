# CI and test harness

CL-004/006 implement the repository workflow and harness. The user selected [amungadev-ai/server_manager](https://github.com/amungadev-ai/server_manager), initially an empty public repository. Its import commit `cc2bd6da1f9ae27d0de21d9ab2a579e21d71a03e` has the exact prepared source tree. [PR #1](https://github.com/amungadev-ai/server_manager/pull/1) is integrated on main at `104c0974434221e9385bcd336ed5a3daab5ac9e1`; its tree matches tested head `704bac37300715d12b570a44859c0a85116fbdbf`. [Required run 44432013149](https://github.com/amungadev-ai/server_manager/actions/runs/44432013149) passes 46 unit/HTTP/gate tests, both static builds and 20 desktop/mobile browser cases. Counted navigation, early mobile UI readiness and fixture-upload inputs are corrected. Earlier isolated browser rerun proof remains linked below. See `evidence/ci-hosted-checks.md` and `evidence/ci-hosted/` for source/run/report identity. The private design preview retains its owner-only audience.

## Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Reproduce pinned application and test dependencies |
| `npm run check` | Types, boundaries, generated contracts, CI policy and browser-test type checks |
| `npm test` | Node HTTP/schema/gate tests and Python Git progress tests |
| `npm run test:ci` | Same unit/integration scope with Node/Python JUnit and summaries |
| `npm run test:e2e:prepare` | Build and copy separate HTTP/demo static outputs; no browser launched |
| `npm run test:e2e:list` | Discover desktop/mobile cases; does not execute a browser |
| `npm run test:e2e:ci -- --project desktop` | Run prepared browser cases in a supported environment |
| `node scripts/browser-evidence.mjs desktop` | Require actual browser markers and passing cases |
| `node scripts/ci-evidence.mjs local` | Record source/toolchain/report hashes; explicitly label browser execution |

The managed workspace currently lacks its preview relay. Browser installation/execution is not performed here as a substitute. On a supported local workstation or GitHub runner, install the pinned Playwright Chromium with `npx playwright install --with-deps chromium`, prepare the static outputs and run both `desktop` and `mobile` projects. CI performs those steps automatically once activated. No signed-in private preview or real owner credentials are required by the test harness.

## Workflow gates

The workflow handles push, pull request, merge queue and manual events without path filters. It uses read-only permissions, immutable verified official action commits, nonpersistent checkout credentials, bounded timeouts and no `pull_request_target`/privileged token flow. Event SHAs are passed through the event file and validated; no PR title or branch text is evaluated as shell code.

`Progress gate` checks committed differences. Implementation includes tools, tests, configuration, additions, changes and deletions. Deleting a checkpoint, moving code into documentation or changing only a not-started task cannot satisfy it. Each declared task can be enforced explicitly:

```bash
python3 scripts/validate_progress.py --base origin/main --task CL-004 --task CL-006
```

This gate proves structure, not truth or semantic task ownership. Review still checks every affected task record. The static fixture artifact ID is passed through the verification job output, so rerunning only a failed browser job reuses the correct existing build rather than guessing a new attempt name. The final `Required checks` job runs even after failures/skips and rejects anything except successful progress, verification and both browser jobs. No test step is allowed to ignore errors.

## Browser fixtures and coverage

| Host | Data | Scope |
| --- | --- | --- |
| `127.0.0.1:4173` | Explicit demo build | Existing read-only sample UI |
| `127.0.0.1:4174` | Production HTTP build plus typed synthetic test responses | Transport/rendered states, invalid response/session cases |
| `127.0.0.1:4175` | Production HTTP build plus the actual unconfigured NestJS API | Real liveness/status/501/404 behavior; no owner session |

All listeners are loopback-only. Fixtures use reserved example domains, fixed timestamps and synthetic UUIDs. No mutation is simulated as successful. API paths never fall through to dashboard HTML. A header identifies test fixtures, and the API fixture has no credential/cookie flow. These tests do not prove real authentication, PostgreSQL, DNS, TLS, deployment or workload isolation.

The desktop project is 1440×900 and the mobile project 390×844. Cases cover navigation/search/deep links, one-field Add Domain and its disabled save, the seven domain sections, appearance persistence, overflow, a default-theme automated accessibility baseline, validated HTTP states and real unconfigured API errors. Actual mobile devices, all-browser compatibility, full palette contrast and v1.13 screenshot parity remain later gates.

## Evidence

Unit/integration jobs emit logs, Node/Python JUnit, exit-code summaries and a source/toolchain/lockfile hash manifest. Browser jobs emit HTML/JSON/JUnit, rendered screenshots, accessibility JSON and failure traces. Evidence uploads use explicit directories, exclude hidden files, have unique per-project/attempt names and expire after seven days.

`browser-execution.json` records real browser/version and viewport annotations from running fixtures. Each execution has a fresh run ID and source commit; discovery clears stale execution markers. Discovery, an empty/stale report, a failed launch or a missing marker cannot satisfy `browser-evidence.mjs`. Do not claim browser success from a build or test list. Baselines are never auto-approved. Review traces before sharing them; only synthetic fixtures belong in this pipeline.

## GitHub activation and branch-protection checklist

- [x] Select the actual GitHub Cloudlane repository and integration branch; confirm source before syncing. The empty repository was initialized with an exact tree match; source histories have distinct commit IDs.
- [x] Enable GitHub Actions and allow the pinned official actions on a supported hosted runner; the first run executed the configured actions.
- [x] Push the prepared source and run the workflow; import/run references appear above. Passing end-to-end acceptance is separate.
- [x] Run a fixture PR changing implementation without a task checkpoint; confirm both gates fail. [Negative run](https://github.com/amungadev-ai/server_manager/actions/runs/44402797421) fails as intended; the subsequent checkpoint and full run pass.
- [x] Confirm desktop/mobile execution, passing markers/viewports, reports/screenshots and failure-only traces. [Run 44403166607](https://github.com/amungadev-ai/server_manager/actions/runs/44403166607) passes 10 cases per project without retries; desktop-only rerun downloads original artifact ID `14473971831` and passes again. Failure traces were verified on the initial failed run.
- [ ] Require the exact `Required checks` status from this workflow's first actual run. Do not guess a repository-specific status context before it exists.
- [ ] Require reviewed pull requests and up-to-date/merge-queue checks; include administrators where repository policy permits.
- [ ] Configure actual CODEOWNERS/reviewers for workflows, security/agent code and contracts. Do not invent GitHub identities.
- [ ] Disallow force pushes and branch deletion; document any narrowly approved emergency bypass and audit it.
- [ ] Verify fork PR policy, absence of exposed secrets, artifact retention and access. These settings are not changed merely by committing YAML.

No item is marked complete without repository-specific evidence. Managed connector permissions may not include repository administration; a maintainer with appropriate access must apply and verify protected-branch settings.

`main` currently reports `protected: false`; reading its protection endpoint returned `403 Resource not accessible by integration`. The connection cannot administer protection. A concrete proposed payload is in `.github/branch-protection.main.json`, using the observed `Required checks` context and GitHub Actions app ID `15368`. An administrator can review and apply it with:

```bash
gh api --method PUT repos/amungadev-ai/server_manager/branches/main/protection --input .github/branch-protection.main.json
```

The proposal requires one approving reviewer and applies checks to administrators. Configure an actual collaborator who can review the author's PRs before enabling that policy. Afterwards read the effective rule and exercise a rejected merge/push; the payload is not proof that settings were applied.
