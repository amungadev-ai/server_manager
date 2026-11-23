# Retained authenticated project evidence

Validated 2026-11-23 (Africa/Nairobi). [PR #7](https://github.com/amungadev-ai/server_manager/pull/7), implementation head `e5a314e03ba1ea03a9a100825fabb5925c08dc21`, [run 44701008424](https://github.com/amungadev-ai/server_manager/actions/runs/44701008424), attempt 1. The tested merge commit `46d822eca59b020336cb87f161aefa8c7befed94` has the same Git tree `cbb5fc71fd2174ee7baf44dd70da3063d4d946ee` as the implementation head, independently verified through GitHub Git objects. Later evidence-only commits keep their own final PR checks; original reports retain their original source identity.

All six jobs pass. JUnit records 77 Node plus 10 Python cases and 58 real PostgreSQL/HTTPS cases, with no failures/skips. Real browser reports record 27 desktop plus 27 mobile cases, all passed with zero retries, Chromium 159.0.8154.6. The unchanged reference comparisons cover 20 scenes per viewport, 40 total. The API project form is also checked across all ten palette/theme combinations on each viewport. Initial browser findings were corrected within API-mode-only form styles and an incorrect test locator was corrected to the unchanged prototype label.

CI uses pinned Node 24.22.3/npm 11.9.0 and real PostgreSQL 18.1 (Debian 18.1-1.pgdg13+2). Node HTTPS clients explicitly trust their isolated test certificate and verify the encrypted socket/hostname. There is no SQL substitute or TLS-verification bypass. No private key/certificate bytes are retained. Browser project/auth fixtures render actual Svelte UI through synthetic HTTPS route fulfillment; they do not establish real browser-to-database/public-CA/Caddy acceptance.

| Artifact | ID | ZIP SHA-256 | Included manifest files verified |
| --- | --- | --- | --- |
| desktop | 14612364753 | 71c36b62a686de61bd37b8bd1032b293d1426800b5ded6e7e5523658ef4c6a69 | 261 |
| mobile | 14613335963 | 7445a7c7d303ec814ed732674473845c7b86e0a0d96750695f447d9d93245ae9 | 258 |
| postgres | 14612309699 | b30d4f7113a627a4fc5df340c66975486a3ea96898d67e89e255e5a773667f2f | 5 |
| verify | 14612507954 | e4dd2a24fb42747022e1644b3970972319432b83541d794343e22aabee05efb6 | 9 |

Archive digests and every included manifest-declared file were checked before retention. Reports live under `run-44701008424/<job>/reports/`; the original `test-results/` prefix maps to `reports/`. Retained files include JUnit, browser execution/expected-run identity, command logs, actual database version and source/lockfile manifests. Bulk screenshot/trace bytes remain in the original hashed CI artifacts. The verification archive omits one referenced discovery file; each browser archive omits one referenced harness-cache file. Those source-upload omissions are recorded, not reconstructed, and are not used as execution proof.

Project tests cover persisted metadata across a restarted HTTPS app; atomic project/environment/retry/audit rollback; concurrent same-key retry; changed-body conflict; workspace/ID/cursor/key isolation; microsecond/tie keyset ordering; MFA/CSRF/Host/Origin/HTTPS/default-deny boundaries; stale rotation/epoch rejection; and logout serialization. Browser cases cover pagination/search, saved/reloaded metadata, escaped project names, safe retry after lost acknowledgement, explicit errors and dismissal/double-submit protection. No workload is provisioned.

The normal API still cannot activate authentication. Independent security review, merge approval, operational roles, installer/root recovery, key custody/restore, trusted Caddy/IP/domain TLS, backups and agent/VPS acceptance remain open.
