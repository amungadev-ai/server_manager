# Hosted CI activation evidence

Recorded 2026-11-19 (Africa/Nairobi). Target: [amungadev-ai/server_manager](https://github.com/amungadev-ai/server_manager), supplied by the user and initially empty/public. The private design preview's audience was not changed.

## Source provenance

GitHub import `cc2bd6da1f9ae27d0de21d9ab2a579e21d71a03e` and Site source checkpoint `1d913666a45dedf8598be71f69d4c54e0605bb19` share the exact tree `ef1b3c8e13916dd56eb56cf8663339f605ba1c95` (202 files). GitHub was initialized through the connected Git data API without overwriting existing work. The histories have different commit IDs; earlier local evidence retains its original source identity.

## Actual runs

| Run | Verified result |
| --- | --- |
| [Initial main run 44401133855](https://github.com/amungadev-ai/server_manager/actions/runs/44401133855), import commit above | Progress, types/lint, 45 unit/HTTP/gate tests and both fixture builds pass. Each browser project has 9 passing cases and 1 project-navigation failure. Required checks fails. Browser reports/screenshots/failure traces and unit evidence upload successfully. |
| [Negative PR run 44402797421](https://github.com/amungadev-ai/server_manager/actions/runs/44402797421), head `f9db7e94f181d3b2115fc4f78848f8b1d73b5e8d` | Actual progress log rejects implementation without an updated active task checkpoint. Required checks fails and build/browser jobs skip. This deliberately exercises the gate, not a passing acceptance result. |
| [Positive PR run 44403166607](https://github.com/amungadev-ai/server_manager/actions/runs/44403166607), head `dc54f493247606d277695cbcc7f70eb7a49c29c2`, attempt 1 | All five jobs pass: progress, types/lint/contracts, 46 unit/HTTP/gate tests, both static builds, 10 desktop and 10 mobile browser cases and final Required checks. No browser retries. Chromium 159.0.8154.6; desktop 1440×900, mobile 390×844. |
| Same run, isolated desktop rerun attempt 2 | Desktop job `135153063732` downloads original `e2e-static-1` artifact ID `14473971831`, passes 10 actual cases and browser-evidence validation, and uploads `browser-desktop-2` ID `14474563506`. Final Required checks succeeds. The build artifact is reused rather than guessed by attempt name. |

[PR #1](https://github.com/amungadev-ai/server_manager/pull/1) corrects navigation's counted accessible name, restores an explicit static-artifact upload name and rejects download-only upload inputs/disconnected output IDs. Both affected task checkpoints were added after the negative gate experiment. The subsequent passing run and browser-only rerun are verified above.

Downloaded attempt-1 artifact digests match GitHub metadata, ZIP CRCs pass, 36 Node/10 Python JUnit cases have zero failures/skips, and every browser case has a matching current run/source marker and rendered PNG. The two attached axe-core 4.14.1 scans contain zero violations (default overview only; no full accessibility/visual/device certification). Retained text reports and source mapping are in `evidence/ci-hosted/`. The PR checkout `4270d5cc883bca5d47eb85dbd647452019dd08c4` is GitHub's test-merge commit; its tree `7ee907406f57d4552c40c804238a067ae557b598` exactly equals the positive branch head tree. It is not the earlier Site commit.

Passing attempt-1 artifacts: [desktop 14473157855](https://github.com/amungadev-ai/server_manager/actions/runs/44403166607/artifacts/14473157855), [mobile 14474516775](https://github.com/amungadev-ai/server_manager/actions/runs/44403166607/artifacts/14474516775), [verification 14474006927](https://github.com/amungadev-ai/server_manager/actions/runs/44403166607/artifacts/14474006927). GitHub retains these archives for seven days; committed text evidence remains in the source.

Initial failure artifacts are retained for seven days by GitHub: [desktop 14473930629](https://github.com/amungadev-ai/server_manager/actions/runs/44401133855/artifacts/14473930629), [mobile 14473575646](https://github.com/amungadev-ai/server_manager/actions/runs/44401133855/artifacts/14473575646), [unit/build verification 14471789659](https://github.com/amungadev-ai/server_manager/actions/runs/44401133855/artifacts/14471789659). Artifact availability expires; these are failure-diagnostic records, not proof of a passing browser suite.

## Branch protection

The branch response reports `main.protected=false`. Protection administration/read returns `403 Resource not accessible by integration`. The observed check context is `Required checks`, produced by GitHub Actions app ID `15368`. No rule was applied. `.github/branch-protection.main.json` and `docs/CI_AND_TESTING.md` contain a concrete administrator payload/command and reviewer-policy consequences. Effective settings and rejection behavior must be verified after administration.
