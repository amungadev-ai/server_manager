# Retained MFA, recovery and authentication UI evidence

Implementation checkpoint `a60d11bf9ebc7a5783fed3688da022dd4e930a02`, [run 44551355426](https://github.com/amungadev-ai/server_manager/actions/runs/44551355426), attempt 1. The tested PR merge commit `27fd092eadb6926d075855ade146fc0fbbb172d0` and implementation head have the same tree `862d42852e1e52b4c876c2f4cacac1514b0feeb0`, verified through GitHub Git objects. Later evidence/test documentation commits retain their own final PR checks; these reports keep their original source identity.

All six jobs pass: progress, build/unit, real PostgreSQL integration, desktop browser, mobile browser and Required checks. Unit JUnit records 70 Node plus 10 Python cases; PostgreSQL JUnit records 46 cases (13 migration/persistence plus 33 owner-auth/MFA/HTTPS). Actual browser execution reports record 22 desktop plus 22 mobile cases, zero retries, Chromium 159.0.8154.6. The immutable v1.13 HTML comparisons remain 20 scenes per viewport, 40 total. No tests are skipped or relabelled from discovery output.

Actual PostgreSQL server: `18.1 (Debian 18.1-1.pgdg13+2)`. Node HTTPS clients trust the generated isolated certificate and verify the encrypted socket/hostname. No TLS verification bypass, SQL substitute, private key or certificate bytes are retained. Browser auth cases are explicitly synthetic HTTPS route-fulfillment fixtures for rendered UI/request behavior, not browser-to-SQL/public-CA evidence.

| Artifact | ID | ZIP SHA-256 | Included manifest files verified |
| --- | --- | --- | --- |
| verification-1 | 14542982229 | 7a448639f17ec359fb2986a99ac6d040fc238d74636f74f8b0c4cd181dfa1b30 | 9 |
| postgres-1 | 14543518206 | 8dfb417098cfa1c7ef904a091b8e7bfac79b03b52ca836491e14a9dbe745c794 | 5 |
| browser-mobile-1 | 14544335022 | 20ab72934148f358faa7e986a514bf3b92dcc46c23e61ac5693add083b101480 | 243 |
| browser-desktop-1 | 14543932104 | 08cb8377a742f5ff7f16cc24f9c635ac1f860239bc6973843ad64faa74e97383 | 246 |

The archive digests and every included manifest-declared file were independently checked before retaining reports. Reports are under `run-44551355426/<job>/reports/`; the original `test-results/` prefix maps to `reports/`. JUnit, real browser execution, expected run identity, command logs and source/lockfile manifests are retained. Bulk screenshots/traces remain in the original hashed CI artifacts. The verification upload omits one referenced discovery file; each browser upload omits one referenced harness cache file. Those omissions are recorded, not reconstructed. Discovery and cache files do not establish browser execution.

Negative coverage includes password-only bypass, challenge CSRF/expiry/attempts, encrypted seed/AAD/key failure, TOTP replay, explicit recovery acknowledgement, atomic one-use recovery, factor epoch/family revocation, lost code-display recovery, regeneration step-up and redacted audit. The first implementation run found Svelte-interpolated regex quantifiers and a brand accessible-name mismatch; the corrected checkpoint passes exact DOM pattern assertions and accessibility checks. Replay tests in the final handoff reuse the actual accepted token to avoid wall-clock boundary ambiguity; final PR checks validate that test-only improvement.

Root recovery remains a documented installer contract. Independent security review, operational key custody/restore, trusted Caddy/IP/domain TLS, installer/agent/VPS acceptance and production activation remain open.
