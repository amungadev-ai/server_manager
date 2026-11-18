# 08 — Logical data model, API conventions and event contracts

**Status:** Database schema design only; initial HTTP runtime schemas, validation and generated OpenAPI now exist under `packages/contracts/` (CL-003), without database migrations or operational resource/auth endpoints. v1.1 defined the core relational outline; v1.7/v1.8 add storage and DNS mode concerns; this document merges them without claiming migrations exist.

## 1. PostgreSQL domains

### Identity and workspace

`users`, `password_credentials`, `mfa_factors`, `recovery_code_hashes`, `sessions`, `api_keys`, `workspaces`, `workspace_members`, `installation_identity`, `installation_claims`, `audit_events`.

The first owner claim is a transactional mutation creating a unique installation owner. Session/claim/API key hashes must not store recoverable plaintext tokens. All human-scoped resources have `workspace_id` and policy checks.

### Infrastructure

`servers(id, workspace_id, agent_identity, capabilities, last_seen_at, desired_version, observed_version)`, `projects`, `environments`, `services(kind, role, desired_state, observed_state, active_deployment_id)`, `service_connections`, `sources`, `deployments`, `deployment_events`, `deployment_artifacts`, `service_secrets`, `persistent_volumes`, `backups`.

Keep unique `(workspace_id, project_slug)` and `(project_id, environment_name)` indexes. Add foreign keys and explicit cascade policy. Never cascade-delete backups or attached volumes without separate confirmation.

### DNS, mail, cron

`domain_zones` with `dns_mode`, `active_dns_mode`, `pending_dns_mode`, verification/delegation state, `zone_revision`, DNSSEC state; `dns_records`, `domain_hostnames`, `domain_bindings`, `dns_mode_transitions`, `tls_certificates`, `mailboxes`, `mail_aliases`; `cron_schedules`, `cron_runs`.

Domain ownership verification, authoritative delegation, hostname routing and certificate status are separate fields/state machines. A manual DNS record is desired guidance; actual external DNS must be verified before marking active.

### Storage

`storage_services`, `storage_buckets`, `stored_objects`, `storage_grants`, `persistent_volumes`, `storage_audit_events`, `retention_policies`. Object content stays in S3-compatible storage, not in platform PostgreSQL. KYC-related metadata requires classification, retention, audit and privileged access controls.

### Job/outbox

`pg-boss` queue tables plus a normalized internal `operations` table containing resource type/ID, desired generation, dedupe key, status, attempts, failure class and correlation ID. Persist durable event/outbox with transaction so no API "success" exists without queued operation.

## 2. API shape (proposed canonical `/api/v1`)

An older sketch used `/v1`; this kit chooses `/api/v1` for public HTTP consistency but is recorded by ADR-014 and tested at implementation time. The table remains a target catalog; only health and installation status are live. Initial declared auth/project/domain/deployment routes validate then return 501; other target routes are not implemented.

| Domain | Representative endpoints |
| --- | --- |
| Installation/auth | `GET /installation/status`, `POST /bootstrap/claim`, `POST /bootstrap/owner`, `POST /auth/login`, `GET /auth/session`, `POST /auth/logout`, MFA and API-key routes |
| Workspace/projects | `GET/POST /projects`, `GET /projects/:id`, `GET /projects/:id/services` |
| Apps/deployments | `POST /projects/:id/apps`, `POST /services/:id/deployments`, `GET /deployments/:id/events` (SSE), `POST /services/:id/rollbacks` |
| ZIP/GitHub | `POST /uploads/init`, chunk upload/finalize, GitHub install/callback, signed webhooks |
| Domains/DNS/SSL | `POST/GET /domains`, `POST /domains/:id/verify`, `POST /domains/:id/dns-mode-transitions`, `POST /services/:id/domain-bindings` |
| Databases | `POST /projects/:id/databases`, users/privileges, backups, restricted network, read-only SQL console |
| Cron | `POST /projects/:id/crons`, `GET /crons/:id/runs`, `POST /crons/:id/runs` |
| Storage | `POST /projects/:id/storage`, `/storage/:id/buckets`, `/buckets/:id/objects`, upload/download intents, grants |
| Access/ops | `POST /services/:id/terminal-sessions`, `GET /activity`, `GET /servers/:id/metrics`, `GET /operations/:id` |

## 3. Uniform request rules

- Input schemas server-side, limits on length, count, size, nested JSON, and IDs. Unknown field handling defined by contract.
- Workspace context resolved from authenticated principal and DB row ownership, never blindly from request body alone.
- Mutations accept `Idempotency-Key` where retryable; return 202 plus `operationId` for asynchronous work.
- Use pagination/cursors, stable sorting, conditional ETag for editable shared resources where needed.
- Errors: `{ "error": { "code": "DOMAIN_NOT_VERIFIED", "message": "...", "requestId": "...", "details": {} } }`. Safe user messages, no raw stack traces or secrets.
- Public-safe health endpoints distinct from admin diagnostic endpoints; audit login failures and permission denials with redaction.
- OpenAPI spec generated from NestJS DTO/schema and consumed by `packages/contracts`/dashboard client; agent protocol independently versioned.

## 4. Example flows and transactions

**Create project:** validate workspace role/name → DB transaction inserts project + production environment + audit → return stable IDs. No agent job needed.

**Deploy ZIP:** validate authenticated uploader/quota → staged upload intents → finalize checksum → create immutable `deployment` and queue operation atomically → worker issues typed commands → append events → mark active only when probe/routing succeeds.

**Add domain:** persist pending zone in Manual mode → return overview ID → request verification separately from DNS Records; domain mode can be changed only through tracked transition under Settings.

**Provision storage:** provider-scoped secret ref validated → create logical resource → queue external action → pending until provider confirms; never simulate object creation in production.

**Complete owner claim:** lock installation row → verify one-time hashed claim/TTL and unclaimed status → create owner/credential/MFA pending transaction → mark claimed and consume claim atomically → issue secure cookie after configured policy gate.

## 5. Migrations and deletion

Use numbered, deterministic, transactional migrations where possible; backfill in batches; never infer a production schema from localStorage shape. Record schema version, tested forward path, restore snapshot and irreversible migration warnings. Tenant/resource-scoped deletion must consider children, running jobs, DNS routes, secrets, volume data and backups. Implement dry-run summaries and explicit confirmation for destructive operations.

## 6. Tests

Relational constraints, unique hostname binding, cross-workspace access, job deduplication/replay, correct 401/403/409/429 errors, secret redaction, API contract compatibility, migration from previous version, rollback/restore, concurrency races and ID guessing. The Go agent must not trust a workspace/service ID just because a request contains it.
