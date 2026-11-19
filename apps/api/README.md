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

The guard never accepts browser role/workspace claims, bearer/agent credentials or forged cookies as owner authority. The successful owner-context path is covered by internal unit fixtures only. See [ADR-018](../../docs/adr/018-api-persistence-foundations.md) for the exact development and production boundaries.

## Verification

`npm run check`, `npm test`, `npm run build` and `python3 scripts/validate_progress.py` cover the standard gates. `npm run test:postgres` additionally requires `CLOUDLANE_POSTGRES_TESTS=1` and a privately supplied `CLOUDLANE_TEST_DATABASE_URL` pointing to an authenticated loopback database named **cloudlane_ci**. It deliberately drops/recreates only that disposable database's `cloudlane` schema. The runner rejects absent opt-in, a different database name, remote hosts and URL options. CI provisions the disposable database automatically and retains actual PostgreSQL JUnit/version evidence. It is a required gate, independent of the normal unit tests.
