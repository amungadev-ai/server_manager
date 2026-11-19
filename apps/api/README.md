# Cloudlane API development foundations

The API is NestJS on loopback, separate from the static Svelte dashboard. The private Site preview does not host PostgreSQL or the Nest process. Authentication, owner claiming, project CRUD, pg-boss and infrastructure operations remain unavailable.

## Build and run

Use the pinned Node/npm versions from the repository. From the root:

```sh
npm ci
npm run build:api
node apps/api/dist/main.js
```

The process binds `127.0.0.1:3001`. `CLOUDLANE_API_PORT` changes the loopback port. API documentation is off in the entry point unless `CLOUDLANE_API_DOCUMENTATION=1`; the local-only development docs disable request submission. `createApp()` is also used by contract generation and creates no database connection unless one is explicitly supplied.

## PostgreSQL configuration and migrations

Provision a private local PostgreSQL database separately. PostgreSQL 18.1 is the current integration-test target; this is not an installer or production version/security recommendation. Copy [the example](.env.example) into a private environment file outside source control, replace its placeholders, and restrict file permissions. Environment files are not loaded automatically. Never put connection strings in a browser build or command argument, paste real values into CI fixtures, or reuse the public disposable test credentials.

With the release source built, an administrator runs:

```sh
node --env-file=/path/to/private/migration.env apps/api/dist/database/migrate-cli.js
node --env-file=/path/to/private/runtime.env apps/api/dist/main.js
```

`npm run db:migrate` builds and migrates when the database URL is already supplied through a private process environment. The fixed migration list lives in `apps/api/migrations/`; include that directory alongside `dist/` when packaging the API. The CLI accepts no SQL/path arguments and prints no database connection details.

This foundation uses authenticated, non-TLS loopback TCP with explicit connection identity, port and TLS policy; host `PG*` identity/port/TLS settings cannot override it. Remote databases or a different TLS policy require a separately reviewed configuration change.

Use a migration role with ownership/create privileges and a separate runtime role. The runtime only checks readiness in this batch, so grant it `USAGE` on schema `cloudlane` and `SELECT` on `cloudlane.schema_migrations`. The database administrator must create and configure the roles locally; the API does not create privileged roles or run migrations on startup. Later repositories require explicitly reviewed CRUD grants. The migration revokes PUBLIC schema/table privileges. No user/session/resource is seeded and no default password is created.

Migrations acquire a bounded transaction-level advisory lock and apply atomically with a checksum ledger. Rerunning a current release makes no schema/data change and preserves the installation identity. A changed, missing or newer history fails closed; investigate and restore or introduce a reviewed forward migration. There is no reset/down command. Back up and verify restoration before changing a populated installation.

## Endpoints in this batch

| Endpoint                                                          | Current behavior                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------- |
| `GET /api/v1/health`                                              | 200 process liveness; not readiness                           |
| `GET /api/v1/health/ready`                                        | 503; coarse DB status and authentication unavailable          |
| `GET /api/v1/installation/status`                                 | Public-safe unconfigured lifecycle, setup unavailable         |
| `POST /api/v1/auth/login`, `/bootstrap/claim`, `/bootstrap/owner` | Strict request validation then 501; no session/claim issuance |
| Resource operations, `/auth/session`, `/auth/logout`              | Owner policy; default resolver denies all callers with 401    |

The guard never accepts browser role/workspace claims, bearer/agent credentials or forged cookies as owner authority. The normal entry point still resolves no sessions; the isolated harness below also exercises real database-backed sessions. See [ADR-018](../../docs/adr/018-api-persistence-foundations.md) for the exact development and production boundaries.

## Isolated owner-auth review candidate

[PR #5](https://github.com/amungadev-ai/server_manager/pull/5) adds real claim/setup/session state and password verification under [ADR-019](../../docs/adr/019-owner-auth-review-profile.md). The normal entry point described above keeps its disabled behavior. No environment or HTTP flag activates the candidate. An internal review harness must construct `OwnerAuthReview` with a disposable database pool and exact HTTPS panel origin, then pass it plus HTTPS key/certificate options to `createApp`. The factory rejects production mode and missing TLS. Production Caddy termination/trusted-proxy configuration, MFA, root installer CLI and independent security approval remain future gates.

The internal `review.store.issueClaim()` function creates a one-time, installation-bound code for the local installer integration to use later; there is no public issuance/reset endpoint. POST claim exchanges that code for a separate Secure/HttpOnly setup cookie and JSON CSRF nonce. POST owner requires that cookie/nonce, creates owner/workspace atomically and reports MFA setup required. POST login issues a new Secure/HttpOnly host-only owner cookie and returns a session-bound synchronizer nonce. Auth mutations require exact Origin and `X-Cloudlane-Request: owner-auth`; owner creation and authenticated mutations additionally require `X-CSRF-Token`. Only same-origin response JSON carries CSRF values; keep them in memory. Never put credentials, cookies or nonces in localStorage or URLs.

POST `/api/v1/auth/session/rotate` changes the cookie and nonce while preserving absolute lifetime. Logout revokes its entire session family under the same lock used by rotation. A rotated old credential can only revoke that family with its own matching CSRF nonce; it cannot inspect or renew a session. Later independent login families remain independent. The candidate still reports readiness 503 with `authentication: review_only` even when its database is current. No real resource handlers are enabled.

Run the PostgreSQL suite for actual race/expiry/replay/CSRF/Host/Origin/TLS tests. The runner generates isolated temporary TLS material and never uploads those key bytes. [Review evidence and limits](../../docs/evidence/OWNER_AUTH_REVIEW.md) distinguish this development candidate from production authentication.

## Verification

`npm run check`, `npm test`, `npm run build` and `python3 scripts/validate_progress.py` cover the standard gates. `npm run test:postgres` additionally requires `CLOUDLANE_POSTGRES_TESTS=1` and a privately supplied `CLOUDLANE_TEST_DATABASE_URL` pointing to an authenticated loopback database named **cloudlane_ci**. It deliberately drops/recreates only that disposable database's `cloudlane` schema. The runner rejects absent opt-in, a different database name, remote hosts and URL options. CI provisions the disposable database automatically and retains actual PostgreSQL JUnit/version evidence. It is a required gate, independent of the normal unit tests.
