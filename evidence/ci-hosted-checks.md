# Hosted CI activation evidence

Recorded 2026-11-19 (Africa/Nairobi). Target: [amungadev-ai/server_manager](https://github.com/amungadev-ai/server_manager), supplied by the user and initially empty/public. The private design preview's audience was not changed.

## Source provenance

GitHub import `cc2bd6da1f9ae27d0de21d9ab2a579e21d71a03e` and Site source checkpoint `1d913666a45dedf8598be71f69d4c54e0605bb19` share the exact tree `ef1b3c8e13916dd56eb56cf8663339f605ba1c95` (202 files). GitHub was initialized through the connected Git data API without overwriting existing work. The histories have different commit IDs; earlier local evidence retains its original source identity.

## Actual runs

| Run | Verified result |
| --- | --- |
| [Initial main run 44401133855](https://github.com/amungadev-ai/server_manager/actions/runs/44401133855), import commit above | Progress, types/lint, 45 unit/HTTP/gate tests and both fixture builds pass. Each browser project has 9 passing cases and 1 project-navigation failure. Required checks fails. Browser reports/screenshots/failure traces and unit evidence upload successfully. |
| [Negative PR run 44402797421](https://github.com/amungadev-ai/server_manager/actions/runs/44402797421), head `f9db7e94f181d3b2115fc4f78848f8b1d73b5e8d` | Actual progress log rejects implementation without an updated active task checkpoint. Required checks fails and build/browser jobs skip. This deliberately exercises the gate, not a passing acceptance result. |

[PR #1](https://github.com/amungadev-ai/server_manager/pull/1) corrects navigation's counted accessible name, restores an explicit static-artifact upload name and rejects download-only upload inputs/disconnected output IDs. Its next checkpoint adds both task records. Final positive browser evidence is pending.

Initial failure artifacts are retained for seven days by GitHub: [desktop 14473930629](https://github.com/amungadev-ai/server_manager/actions/runs/44401133855/artifacts/14473930629), [mobile 14473575646](https://github.com/amungadev-ai/server_manager/actions/runs/44401133855/artifacts/14473575646), [unit/build verification 14471789659](https://github.com/amungadev-ai/server_manager/actions/runs/44401133855/artifacts/14471789659). Artifact availability expires; these are failure-diagnostic records, not proof of a passing browser suite.

## Branch protection

The branch response reports `main.protected=false`. Protection administration/read returns `403 Resource not accessible by integration`. The observed check context is `Required checks`, produced by GitHub Actions app ID `15368`. No rule was applied. `.github/branch-protection.main.json` and `docs/CI_AND_TESTING.md` contain a concrete administrator payload/command and reviewer-policy consequences. Effective settings and rejection behavior must be verified after administration.
