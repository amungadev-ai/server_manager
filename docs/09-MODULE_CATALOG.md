# 09 — Module-by-module behavior and scope

This catalog is a compact contract for the UI migration and later backend modules. For precise prototype screens, open `reference-cloudlane-v1.13.html`; for domain, terminal and storage details, consult corresponding original blueprints.

| Module | Navigation / key tabs | MVP behavior | Defer / caution |
| --- | --- | --- | --- |
| Overview | Overview, Create New | real counts/health, recent activity, quick actions, compact stats and project tiles | do not replace metrics with fake success labels |
| Projects | Projects → Project | search, create project, Services/Architecture/Storage, production environment and service associations | team membership/multiple environments later; Architecture is descriptive and binds only confirmed links |
| Applications | Project → Service | ZIP/GitHub source, autodetection, settings, variables, deployment history/logs, HTTPS, rollback, immutable Artifacts, named Volumes | terminal gated; heavy builds off-host on 1GB |
| Domains | Domains → Detail | one-field Add Domain; seven tabs; Manual DNS default; Managed DNS under Settings; verified bindings | no registrar APIs required; Managed mode disabled until real NS infrastructure |
| Databases | Databases → Detail | PostgreSQL/MySQL/MariaDB provisioning on demand; private connection; users/privileges; backups, read-only SQL console | engine-appropriate permissions, no exposed DB by default; admin UIs on demand |
| Email | Email and Domain → Email | global mailbox/alias index; domain-scoped configuration; DNS records guidance | external provider preferred; no always-on local mail stack at 1GB |
| Cron Jobs | Cron Jobs and Project services | scheduled HTTP callbacks, timezone, run history, retries, timeout, overlap rules | URL SSRF controls; no arbitrary root cron execution |
| Object Storage | Create New / Project → Storage | external S3-compatible, private bucket, scoped Files explorer, metadata, object grants, quota/audit | KYC content private, no arbitrary server file browsing; no local S3 engine needed at 1GB |
| Activity & Logs | global index, service logs | filterable, correlated, sanitized events and operational status | real log rotation, permission checks and retention |
| Server | Server/Settings → Server | IP/OS/memory/disk/process health, installation health, safe update info, SSH guidance | no web-root shell, no external agent port |
| Settings | Workspace, Integrations, API Keys, Security, Server, Preferences | owner settings, integrations, key lifecycle, policies, design palettes | no fake credentials; MFA/roles backed by API |
| Assistant | movable launcher/drawer | contextual read-only diagnosis and typed/approved plan; UI parity | model integration optional, no unrestricted actions |
| Documentation | sidebar footer | install, operational runbooks, resources, API and troubleshooting | keep docs versioned and aligned to actual release |

## Resource-level page states every agent must implement

For each index and detail screen: `loading`, `empty`, `ready`, `pending`, `error`, `permission-denied`, `offline/stale`, `action-in-progress`, `action-failed`, `action-complete`. UI must never claim infrastructure is healthy solely because a local JavaScript timer finished. Network failures should not erase previous useful information; make stale state explicit.

## Terminal/SQL/storage boundary reminder

- An application terminal targets **one known running container**, short-lived session, explicit permission and bounded commands; agent checks scope. It is not SSH.
- SQL console targets **one authorized DB principal**, read-only MVP queries with time/result limits and audit; separate from container shell.
- App release artifacts are immutable manifests/source snapshots; object storage holds user media; volumes are allocated mounts; host OS files are never exposed.

## Maid Finder reference workflow

Use synthetic sample project for parity: Express API, Next.js admin dashboard, MySQL service, cleanup cron, external S3-compatible media storage, separate private KYC and profile-photo buckets, explicit app-bucket grants. Expo mobile app builds/distribution remain outside Cloudlane. The prototype's KYC objects are **metadata only** and contain no actual images.
