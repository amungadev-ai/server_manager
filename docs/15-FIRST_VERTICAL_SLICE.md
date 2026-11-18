# 15 — First complete vertical slice (implementation playbook)

**Goal:** On a disposable supported Ubuntu VPS, install a small real Cloudlane instance, securely claim the first owner, log into a SvelteKit dashboard, upload a static ZIP, deploy, view actual logs and access the hosted service over real HTTPS when a verified hostname is available.

This is the **definition of a successful first real Cloudlane build**, not a claim it already exists.

## Stage A — Initialize repository

1. Create a shared Git repository with this kit at root; protect the integration branch; claim architecture, API/contracts, and installer tasks by task ID when their dependencies permit.
2. Pin Node package manager and Go version via lockfiles/toolchain files; configure linter, formatter, Svelte checks, NestJS tests and Go tests.
3. Install SvelteKit static app `apps/dashboard`, NestJS `apps/api`, Go `agent`, `packages/contracts`; add `DemoInfrastructureApi` and `HttpInfrastructureApi` interfaces.
4. Convert Cloudlane shell and `Overview`/`Projects`/`Domains` under v1.13 visual parity. No real sign-in yet outside scoped test fixtures.
5. Wire GitHub PR progress gate; test one agent PR that modifies code without progress and confirm it is rejected.

**Exit evidence:** fresh clone, dependency install, static build, lint/test, screenshots, progress validation.

## Stage B — Real API and auth storage

1. Provision PostgreSQL on disposable host or local test container with private port; create deterministic migrations for installation identity, users/sessions, projects/environments and operations.
2. Implement `/api/v1/installation/status`, bootstrap claim transaction, owner creation, login/session/logout, step-up/recovery scaffolds with secure cookie and CSRF behavior.
3. Add authz guards to `/api/v1/projects` and basic project create/list; forbid anonymous and cross-workspace access.
4. Add UI routes for claim, owner creation, MFA and login; connect to real authenticated API, not localStorage demo auth.

**Exit evidence:** API integration tests, expired/replay claim tests, cookie flags, browser login/logout, real DB project create/read.

## Stage C — Installer + trusted HTTPS

1. Version/pin installer release and checksums; implement preflight + idempotent stage journal. Install prebuilt static assets, DB/API/agent/Caddy on fresh test VPS.
2. Configure Caddy panel `https://public-IP` using publicly trusted IP cert with short-lived profile on tested client/version. Monitor renewal. If impossible, secure loopback tunnel fallback.
3. Protect bootstrap claim code locally, print it once in CLI, test TTL/consumption and owner creation from web HTTPS.
4. Implement `cloudlane doctor`, safe repair, reboot restart, sane OOM/disk admission.

**Exit evidence:** independent fresh-VPS installation recording: OS version, memory/disk idle, certificate issuer and SAN, setup flow, reboot test and no unsecured public owner setup.

## Stage D — Real ZIP deployment

1. `POST uploads/init` and chunk/finalize with validation; server-side archive protections and immutable source hash.
2. Create deployment/operation DB record and pg-boss job transactionally; stream real stage events.
3. Go agent accepts typed `release.startCandidate`/stop/inspect and route update commands only; reject unapproved operations.
4. Launch resource-bounded candidate, probe readiness, configure verified service host routing, set live active deployment after actual HTTPS confirmation.
5. Attempt deliberate broken deployment: previous healthy service must continue responding. Exercise rollback.

**Exit evidence:** live URL screenshot/curl response, sanitized event stream, current/previous release digests, failure-path test, resource metrics on starter host.

## Stage E — Release criteria and handoff

- Security review of agent boundary, claim/session, upload extraction and Docker isolation.
- CI passes with progress file and acceptance evidence.
- A second engineer can clone, install and reproduce from docs alone.
- Restore from off-server backup to clean VPS and log in as same owner.
- Then expand to GitHub, dynamic apps, domain management, resources and AI tools per roadmap.

## What not to optimize too early

No multi-server orchestration, in-browser root terminal, full DNS nameserver network, self-hosted email stack, billing, social login or Kubernetes. Those workstreams must not block safe installation and first real deployment.
