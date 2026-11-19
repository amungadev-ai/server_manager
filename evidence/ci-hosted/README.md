# Verified hosted reports

Source: [Cloudlane CI run 44403166607](https://github.com/amungadev-ai/server_manager/actions/runs/44403166607), attempt 1. GitHub branch head `dc54f493247606d277695cbcc7f70eb7a49c29c2`; test-merge checkout `4270d5cc883bca5d47eb85dbd647452019dd08c4`; both have tree `7ee907406f57d4552c40c804238a067ae557b598`.

Copied text reports preserve their original contents. `browser-summary.json` records validation of actual case markers, viewports, zero retries, 20 rendered PNGs and the two embedded axe attachments. Full screenshots/HTML and original axe JSON remain in the GitHub artifact archives; no live credentials or infrastructure are used.

| Saved file | Original archive path |
| --- | --- |
| `desktop-execution.json`, `mobile-execution.json` | `test-results/e2e/browser-execution.json` in each browser archive |
| `desktop-manifest.json`, `mobile-manifest.json` | `test-results/manifests/<project>.json` |
| `node-junit.xml`, `python-junit.xml` | `unit/node-junit.xml`, `unit/python-junit.xml` in verification archive |
| `unit-summary.json`, `verify-manifest.json` | `unit/summary.json`, `manifests/verify.json` |

| Artifact | ID | SHA-256 verified after download |
| --- | --- | --- |
| browser-desktop-1 | 14473157855 | `0f128b43b3c7d1b7913be3d8322d2d3d4fcc30b6613240b676ab4ce7bc33ed2c` |
| browser-mobile-1 | 14474516775 | `92acabd2eb994a13d1bb09f5f741fd010baec3d63a3d253669bb4dea3d0d1127` |
| verification-1 | 14474006927 | `cd9f9de15f0fa8fcfe90b21ad74913629f0b2c569a71033e9652ce9ab845bd4e` |

Every ZIP passed CRC validation. Manifests hash original report paths, so use the mapping above when checking copied reports. These reports verify the synthetic browser harness and existing unconfigured API; real authentication, installer, agent and VPS isolation remain separate unimplemented security gates. See `../ci-hosted-checks.md` for actual negative/positive runs, rerun proof and the unapplied branch-protection settings.
