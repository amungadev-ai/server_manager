# ADR-018 — API access policy and PostgreSQL migration foundations

Date: 2026-11-19 (Africa/Nairobi). Tasks: CL-030, CL-031.

Status: implemented for development review. Bootstrap/session issuance and production security approval remain gated by CL-005 and CL-032/033. This ADR does not accept the separate ADR-017 cryptographic proposal.

## Context

The existing NestJS API declares resource and authentication contracts but returns 501 for all valid non-platform requests. The next vertical slice needs a durable control-plane schema and an API boundary that cannot become public by forgetting an annotation. The Svelte prototype conversion is the approved visual baseline and is outside this backend batch.

## Decision

- A global Nest guard requires an explicit public or owner policy. Missing/unknown policy denies access. All resource operations, session inspection and logout require an owner; only liveness, safe readiness, unconfigured installation status and the unavailable login/first-owner declarations are public.
- An internal server-side session resolver is the sole source of human authority. Its shipped implementation is disabled and resolves no sessions. Headers, body/query authority fields, bearer/agent keys, cookies and `request.user` cannot bypass this default. Unit fixtures exercise future resolver success and denial paths without introducing an HTTP test-login endpoint or runtime authentication override.
- Authenticated context is a frozen, request-specific value derived from validated resolver data. A future repository must derive workspace scope from that context and check each resource's ownership. The guard alone does not implement object-level authorization or CSRF, and no mutation is enabled by this batch.
- Protected anonymous requests now return 401 before route parameter/body pipes. Public unavailable login/claim/owner routes still validate strict schemas and return 501. The JSON size/content-type/parser limits remain ahead of the guard. OpenAPI describes both states rather than promising success.
- Use PostgreSQL through pinned `pg`; do not substitute SQLite, an in-memory SQL emulator or browser persistence. The connection is explicit and loopback-only for the locked single-VPS topology, with a four-client pool, bounded connect/query timeouts, no ambient `PG*` fallback and no URL option overrides. Remote databases require a separately reviewed TLS/network configuration change.
- An explicit local deployment/installer migration command runs the release's fixed migration list. The API process never performs DDL automatically. One PostgreSQL client owns the entire transaction; a transaction-scoped advisory lock serializes even initial schema creation. Lock/statement/idle transaction timeouts bound failure. All pending migrations, schema and ledger changes commit together or roll back together.
- The ledger stores a SHA-256 digest of each migration's exact UTF-8 SQL. Divergent, non-prefix or newer histories fail closed. Applied migrations are append-only: repair/upgrade uses a new migration. No automatic down migration or destructive reset is offered. Take and verify a backup before future upgrades to a populated installation.
- The initial schema creates one durable installation identity, no owner, no login session and no demo resources. Relational constraints enforce one owner, workspace ownership, workspace-local project slugs and matching project/environment scope. Sessions reserve hash-only token storage and lifetime constraints; this does not choose or implement a credential-verification protocol. The first-owner/MFA/session security design is still a later gate.
- Liveness remains a small public process check. `/api/v1/health/ready` returns 503 and coarse database/authentication states; a current database never implies authentication or platform readiness. Public installation status stays unconfigured until its real lifecycle is implemented. No database URL, schema rows, claim material, owner email or driver errors are returned.

## Alternatives and effects

Allow-by-default decorators risk accidental data exposure. Letting body validation stand in for authorization does not establish identity. Running migrations per request or through a pool's independent queries cannot ensure transaction ownership. A checksum ledger without a concurrent lock can race on a fresh install. Automatic resets/down migrations could replace installation identity or destroy owner data, so none are implemented.

The current runtime uses only schema-readiness queries. A migration role needs schema creation/ownership; a separate runtime role needs only `USAGE` on `cloudlane` and `SELECT` on `cloudlane.schema_migrations` in this batch. Runtime CRUD grants and application repository scope arrive with the implementing tasks. PUBLIC has no schema/table grants. Neither the API nor its migration CLI creates OS users, shells out, provisions workloads or exposes an arbitrary-SQL endpoint.

## Compatibility and review gates

The existing public health/status payloads remain compatible. The new readiness contract is additive. Anonymous protected API calls change from 501/shape errors to 401; clients already handle `SESSION_REQUIRED`. Draft success responses remain unavailable. No dashboard, CSS, palette, sample data or prototype file is changed.

CL-030/031 may enter development review after reproducible checks. Independent security review, CL-032/033 race/replay/CSRF/session tests, local role provisioning, pg-boss, installer integration, trusted TLS, backup/restore and actual VPS evidence are not completed here. A single-owner database uniqueness constraint is not evidence of a secure atomic owner-claim exchange.

## Evidence and primary references

Tests and exact run evidence: [API/persistence batch](../evidence/API_PERSISTENCE_BATCH.md). CI runs the SQL against a digest-pinned disposable PostgreSQL 18.1 container and uploads database JUnit/version/source evidence. The required job fails if database integration fails or is skipped.

- [node-postgres transactions](https://node-postgres.com/features/transactions): one checked-out client owns the transaction and is released on success/failure.
- [PostgreSQL transaction-level advisory locks](https://www.postgresql.org/docs/18/explicit-locking.html#ADVISORY-LOCKS): lock lifetime follows the transaction.
- [PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html): relational uniqueness and compound foreign keys enforce storage invariants.
