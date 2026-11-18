# 02 — Technical architecture and trust boundaries

**Status:** Target architecture, not running services. A design from the v1.1 implementation blueprint, updated with the agreed static SvelteKit dashboard.

## 1. Topology

```text
Internet / browser
    │ HTTPS (IP-first dashboard; optional custom host)
    ▼
 Caddy (system entry point, ACME, host routing)
    ├── prebuilt SvelteKit static dashboard (no production SSR process)
    ├── /api/v1/* -> NestJS API (loopback/private network only)
    └── public service hostname -> allocated Docker app network / service
                              │
 NestJS API ───────────────────┤
    ├── PostgreSQL control-plane schema and pg-boss (local, private)
    ├── same-process bounded worker OR dedicated worker on larger profile
    ├── secrets / auditing / RBAC / migrations
    └── authenticated typed operation channel (UNIX socket initially proposed)
              │
          Go server agent (privileged operations only; no user host shell)
              ├── constrained Docker release operations
              ├── Caddy config/reload through validated generated config
              ├── allowlisted volume/network operations
              └── bounded metrics / state reconciliation

Customer application containers and databases live in separate networks with quotas.
External S3/backup targets and optional managed DNS remain independent integrations.
```

## 2. Service responsibilities

| Component | Owns | Must never own |
| --- | --- | --- |
| SvelteKit static dashboard | presentation, client-side route components, optimistic UI, accessible control behavior | secrets, authorization decisions, agent commands, plaintext credentials in localStorage |
| Caddy | TLS, panel API proxy, configured service hostname ingress, limited upstream routing | authentication business logic, DNS ownership by itself |
| NestJS | owner sessions, project/domain/resource CRUD, permissions, job requests, event/audit reading, webhook signature checks | generic host root shell, browser-derived trust claims |
| PostgreSQL | durable platform records, session hashes, encrypted-secret envelopes, jobs, events and migrations | public network listening or raw uploaded KYC bodies |
| pg-boss | deduplicated, retriable queue processing and cron coordination | arbitrary script execution or best-effort jobs without durable state |
| Go agent | only typed, signed/scoped resource operations and observed state | unbounded `exec`, arbitrary host mount paths, direct browser/LLM commands |
| Docker | isolated application runtimes, network/pid/cpu/memory policy, named volumes | public TCP Docker API, shared unrestricted runtime secrets |
| DNS provider (optional) | external public nameserver authority in Managed mode | access to user app secrets, SSH keys or host OS files |

## 3. Network and privilege plan (proposed)

- Only Caddy needs inbound 80/443. SSH remains external OS administration and must not be weakened by Cloudlane.
- Bind NestJS API and its health/metrics endpoints to loopback or a private Caddy-accessible network; never expose DB/agent management ports publicly.
- PostgreSQL binds private/loopback and is authenticated; platform DB is separate from customer databases and credentials.
- Go agent controlled through locally permissioned IPC initially. Define protocol version, command ID, server/service scope, expiry, signature/authorization, desired generation and idempotency key.
- Customer apps cannot mount Docker socket, agent socket, platform secrets volume, host root filesystem, or platform PostgreSQL network.
- Inbound app traffic only through Caddy; isolate app-to-app and app-to-database connectivity using explicit service grants.
- Apply resource limits (`memory`, `cpu`, `pids`, logging cap), non-root app identity where feasible, read-only root filesystem where compatible, and restrict privileged capabilities.
- Threat model must cover the dangerous case of untrusted app builds on the same machine as the privileged control plane. Initial launch assumes a single owner deploying code they trust. Multi-tenant arbitrary uploads require additional isolation architecture.

## 4. Data and control planes

The **control plane** comprises dashboard, API, platform DB, jobs, agent, proxy config and credentials. The **workload plane** comprises user apps, user databases, volumes, object storage connections and runtime logs. An error in customer code must not gain write access to control-plane tables or credentials.

All externally visible resource states are derived from two fields:

- `desired_state` — what the authenticated operator requested.
- `observed_state` — actual agent/runtime measurement, timestamped with drift and TTL.

Reconciliation jobs compare these and record drift, instead of treating UI actions as proof of success. A queued job has a unique idempotency key, bounded retries, timeout, audit trail and clear terminal outcome.

## 5. Reliability model

- Atomic migrations on startup/install; backup metadata before schema changes.
- Durable queue and outbox-like event creation in the same database transaction; recover after worker interruption.
- Deploy candidate without routing traffic; health-check then atomically activate. Preserve prior healthy release for rollback within disk budget.
- Caddy generated routing must be validated before reload; rollback invalid config.
- Certificates, database volumes, encryption keys and host-specific install identity persist across upgrades.
- Health checks distinguish liveness (process alive), readiness (able to serve correct state) and agent observed state (resources work).
- Off-server backups and **restore drills** are required before claiming production readiness.

## 6. Resource profile

| Profile | Promise | Guardrails |
| --- | --- | --- |
| Starter target | Attempt control plane on 1 vCPU / 1 GB / 10 GB; performance MUST be measured | bounded worker concurrency (initially 1), prebuilt UI/OCI images, disk preflight, off-host builds/backup, optional customer DB |
| Standard recommended | 2–4 GB or more for local builds and databases | broader concurrency only after load tests; still enforce quotas |

Do not claim 1 GB is sufficient until full installer + idle control plane + one workload + recovery tests pass with memory/OOM and disk telemetry. Include swap policy and its performance impact in test records; avoid hiding a failure with large swap.

## 7. Interfaces and versioning

- Canonical proposed HTTP base: `/api/v1` (the v1.1 sketch used `/v1`; this kit standardizes the outward shape for new code; log this in ADR).
- Agent contract: `command_version`, `command_id`, `resource_id`, `operation`, `payload`, `expires_at`, auth context; strict schema validation and allowlist.
- Frontend generated API client from OpenAPI contract; never maintain two independently invented request shapes.
- Events include `event_id`, `workspace_id`, `actor_type/id`, `resource_type/id`, `action`, `status`, `created_at`, `correlation_id`. Never log raw tokens or sensitive file data.
- Every breaking API/agent schema change needs compatibility notes and a rolling upgrade sequence.

## 8. Server modules and ownership

`auth` (owner claim/session/MFA), `workspaces`, `projects`, `environments`, `services`, `deployments`, `domains`, `dns`, `certificates`, `databases`, `cron`, `storage`, `email`, `integrations`, `audit`, `metrics`, `agent`, `jobs`, `install`. Each is an explicit NestJS module. Agent host functions are separate from API services; no controller shells out to Docker directly.
