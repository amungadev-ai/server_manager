# Local CI evidence

These reports were copied from a clean checkout of implementation commit `237174e33ea6100a682010ede309a948579b5ea2` on 2026-11-18. Pinned `npm ci`, `npm run check`, `npm run test:ci` and `npm run test:e2e:list` succeeded. Node JUnit has 35 cases and Python JUnit has 10, with zero failures or skips. Browser discovery listed 20 cases; no browser ran.

| Saved file | Original path |
| --- | --- |
| `node-junit.xml` | `test-results/unit/node-junit.xml` |
| `python-junit.xml` | `test-results/unit/python-junit.xml` |
| `summary.json` | `test-results/unit/summary.json` |
| `discovery.json` | `test-results/e2e/discovery.json` |
| `manifest.json` | `test-results/manifests/clean.json` |

The manifest preserves source/toolchain/lockfile and report hashes under the original paths, with `workingTreeDirty: false` and browser execution `not-run`. Discovery is evidence of configuration only. GitHub workflow execution, uploads, protected-branch settings and rendered browser/accessibility results remain unverified. See `../ci-checks.md` and `../../docs/CI_AND_TESTING.md`.
