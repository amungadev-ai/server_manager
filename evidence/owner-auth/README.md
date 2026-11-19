# Retained PostgreSQL and HTTPS review evidence

[Run 44534915294](https://github.com/amungadev-ai/server_manager/actions/runs/44534915294), attempt 1, tests source head `30e611aa238a6b781c234be18b611c82d0e197f6`. The tested PR merge commit `02f8f5a0f4c5eb863490285c1b010b47312714f8` has the same Git tree `be446eb4008b65acad8d0d4e2a951c92bf8ede17` as that source head. Final PR #5 checks identify any later documentation/evidence checkpoint.

All six jobs pass: progress, build/unit, real PostgreSQL, desktop, mobile and Required checks. The run passes 62 Node + 10 Python cases, 34 PostgreSQL/HTTPS cases (13 migration + 21 owner-auth), 16 desktop + 16 mobile browser cases and 40 direct prototype screenshot comparisons. Both HTTP and explicit demo static builds pass the fixture-exclusion gates.

PostgreSQL job `135597799133` uses actual `18.1 (Debian 18.1-1.pgdg13+2)` under the workflow's immutable image digest. TLS tests use freshly generated temporary keys; clients explicitly trust their test certificate and verify the actual encrypted socket/hostname. No private key or certificate bytes appear in the artifact.

Artifact `14535227855` (`postgres-1`, 5393 bytes) was downloaded and verified as SHA-256 `cc4718c675f0ca3481a6d1ddfd88f408a7c395a1c96ec7b493cc33d7689e06d7`. All six archive files are retained under `run-44534915294/reports/`, preserving archive names; the CI `test-results/` prefix maps to `reports/`. The five file sizes/hashes in `manifests/postgres.json` were independently checked against the retained bytes. JUnit, actual server version, command log/result and source/lockfile manifest are preserved without relabelling them as another source.

The real negative cases cover one-use races, lease/generation/expiry, atomic owner rollback, native Argon2, cookie authority and fixation, CSRF/Host/Origin/TLS, credential changes, revocation, rotation/logout interleavings, durable throttling and redaction. These are isolated development-profile checks. Independent security review, MFA, installer/Caddy integration, real CA/restore/VPS acceptance and production activation remain open.
