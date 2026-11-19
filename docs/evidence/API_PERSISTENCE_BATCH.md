# CL-030/031 API and PostgreSQL batch

Recorded 2026-11-19 (Africa/Nairobi). Canonical review: [PR #4](https://github.com/amungadev-ai/server_manager/pull/4), branch `task/CL-030-031-api-persistence`, stacked on prototype parity [PR #3](https://github.com/amungadev-ai/server_manager/pull/3) at `2aecfde1257cd317d18d242fb96e8c309a79c519`. Initial shared claim: `4828c21c0cf66b6676ec8aee89e4772b1055434e`. No merge, reviewer approval, live authentication or production infrastructure claim is made.

## Implemented scope

- Global deny-by-default Nest route guard, explicit public/owner annotations, frozen server-derived request context and disabled-by-default session resolver. Negative tests cover missing policy, forged authority, expiry, revocation, malformed records, non-owner/agent/API-key identities and resolver failures.
- Additive public-safe readiness endpoint; database-ready is distinct from authentication-ready. Protected anonymous requests now receive 401 before schema pipes. Generated OpenAPI/client types describe policy and unavailable success paths.
- Pinned PostgreSQL driver and loopback-only bounded configuration; fixed local migration command with one-client transaction, concurrent advisory lock, SHA-256 history checks, rollback and safe connection release. No automatic startup DDL or down/reset command.
- Initial relational schema for installation identity, single owner, workspaces, hash-only session records, projects and production environments. No demo seeds or default user. Compound foreign keys and per-workspace constraints reject inconsistent scope.
- Mandatory digest-pinned real PostgreSQL CI job and uploaded JUnit/server-version/source manifest. Missing, skipped or failed database integration cannot satisfy the final Required checks job.

## Reproduce

```sh
npm ci
npm run check
npm test
npm run build
python3 scripts/validate_progress.py
```

Run `npm run test:postgres` with the explicit disposable-database opt-in described in [API setup](../../apps/api/README.md). The CI workflow provisions its own PostgreSQL container. The environment has no local PostgreSQL/Docker binary; real SQL behavior is accepted only from the hosted job, never inferred from unit mocks. Final source/check/run links are recorded in PR #4 and the canonical task checkpoints.

## Local checkpoint

PASS: reproducible dependency installation; npm run check; npm test (54 Node + 10 Python cases, zero failures/skips); supported npm run build and explicit demo build; progress validation and formatting. A TypeScript indexed-access error and API README formatting were corrected before the final pass. Safe driver/commit-acknowledgement failures are tested. The immutable HTML SHA-256 remains `f94204ed5e52ae58a80deea46d4fe6edba6626d8b0e36005f6fb9d9765a68f6d`. Hosted SQL/browser execution is pending at this checkpoint.

## SQL acceptance cases

Fresh schema and empty owner/session/resource tables; repeat runs and connection recreation preserve identity/data; two concurrent migrators apply exactly once; failing initial migration rolls back schema/ledger/identity; failing upgrade retains earlier identity/data; checksum/newer history rejection; bounded advisory lock failure/retry; one-installation/owner constraints under concurrency; cross-workspace environment rejection; per-workspace slug and field constraints; session hash/lifetime/workspace constraints; readiness against a real schema and denial of forged cookies. These establish storage/guard behavior only, not the CL-032 owner-claim or CL-033 session protocol.

## Limits and next gate

CL-005's independent security review remains pending in PR #2. CL-032/033 claim/session issuance, cookie/Origin/CSRF/rate-limit policy, password hashing and MFA are not implemented. Object-level authorization, API-backed project CRUD, audit/queue, installer role provisioning, live TLS, PostgreSQL restore/upgrade and actual VPS resource evidence remain later tasks. The published dashboard remains a memory-only simulation with its approved prototype rendering. This backend batch cannot make the static Site host a Nest/PostgreSQL service.

The initial development schema is append-only after application; future changes require a forward migration and reviewed backup/restore process. No source or infrastructure secrets belong in localStorage, fixtures, source or evidence.
