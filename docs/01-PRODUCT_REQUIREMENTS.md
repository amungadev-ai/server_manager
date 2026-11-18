# 01 — Cloudlane product specification

## 1. Vision and initial audience

Cloudlane turns a freshly installed VPS into an approachable application hosting/control platform. It combines guided deployments, resource management, domain/email administration and safe infrastructure controls. It is **self-hosted and single-owner first**, not a public untrusted multi-tenant PaaS at launch. Future extensions must not degrade the low-friction starter installation.

Five non-negotiable pillars:

1. **AI-native guided infrastructure** using explicit permission checks and approval before mutation.
2. **Unified workspace** and canonical entry point for every resource.
3. **Zero-friction deployment** from ZIP or GitHub through one release pipeline.
4. **Safe self-healing** via deterministic restarts, rollback and audit-first incident handling.
5. **Expandable platform** from one server to multi-server/teams without requiring those features in MVP.

## 2. Entity hierarchy and shared rules

`Workspace → Project → Environment → Service`. Each service has identity, owner context, server, desired/observed state, history and permissions. One default `production` environment per project in MVP. A project may be created inline as part of creating an application, database, cron or storage service. Global domains and email are registered/managed once and associated contextually with services.

- **Application** — static website, React, Next.js, Express, NestJS, APIs, workers. ZIP/GitHub share pipeline.
- **Database** — PostgreSQL/MySQL/MariaDB, private by default, scoped users/privileges and backups.
- **Cron** — independent scheduled HTTP callback or a project-associated job; history, schedule, timezone and retry policy.
- **Object storage** — external S3-compatible integration first, private bucket, virtual prefix-based explorer and app-level grants.
- **Domain** — globally registered domain/hostname, DNS state, bindings and SSL; one management location.
- **Email** — global mailbox/alias overview and domain-scoped management; external transport/provider first.

## 3. Navigation contract

Sidebar, in order (as established in the prototype):

- **Workspace:** Overview, Projects.
- **Resources:** Domains, Databases, Email, Cron Jobs. Contextual Object Storage from Create New or project Storage.
- **Infrastructure:** Activity & Logs, Server.
- **Preferences:** Settings.
- **Footer:** Documentation and account/workspace identity.

No workspace-switcher block and no prototype-warning block in the production sidebar. Keep dense but accessible menu targets. The topbar should not duplicate Create New controls already offered in context.

## 4. Required user journeys

### Fresh install and owner onboarding

Fresh VPS → verified CLI installer → preflight → install platform → obtain trusted panel IP HTTPS if eligible → one-time claim → create owner and MFA/recovery → optional workspace/domain settings → Overview. No domain required to begin. Never show a public plaintext credential wizard.

### First deployment

Overview → Create New → Application → choose/create project inline → source ZIP or GitHub → autodetect framework → review only necessary build/start variables → enqueue → live logs/stages → health check → switch traffic → obtain default public URL when supported → attach verified custom hostname later. On failed candidate, retain previous healthy version.

### Domains and email

Domains → Add Domain (one name field) → pending zone → Overview, DNS Records, Subdomains, Connections, SSL, Email, Settings. Default Manual DNS; Managed DNS mode in Settings only, staged migration. Service Domain tab merely selects verified free hostname. Global Email lists mailboxes across domains; domain Email tab manages specific domain.

### Infrastructure operations

Databases → provision → connection details → users/privileges → backup/restore → read-only SQL tool when authorized. Cron Jobs → create HTTP schedule → Run now/history. Settings → Server shows SSH guidance, not in-browser host SSH. Application Terminal is restricted to app container; separate permission, lifetime and audit.

### Storage and data isolation

Project → Storage → external provider → private bucket(s) → Files (object keys/prefixes) → application grants → usage/quota. Application Artifacts are immutable deployment files; Volumes are named allocations with permitted container mount points; OS files remain inaccessible.

### Assistance

Draggable small Assistant launcher; contextual read-only diagnosis; proposed typed plan; display risks and required permissions; explicit approval for mutation; audit through same API as UI. No arbitrary shell or SSH tool and no automatic dangerous action.

## 5. Design and accessibility requirements

Svelte implementation must visually match v1.13: Inter/JetBrains Mono, five palette families in light/dark, compact metrics, Projects and Domains card density, mobile project service cards, 40px mobile / 42px desktop draggable Assistant. Keep keyboard navigation, clear focus, accessible controls, text+color status, reduced-motion preference. Verify visual parity against 1440px and ~390px screenshots; snapshot images alone do not prove usability.

## 6. Not in first public release

Multi-tenant arbitrary public code hosting, Kubernetes, billing, reseller accounts, full self-hosted SMTP/IMAP stack, multi-server federation, real browser host SSH, local LLM, mobile-app build distribution, arbitrary persistent host mounts, full admin database GUI always resident on 1 GB VPS. Their routes can have noninteractive placeholders only when clearly marked unavailable; do not masquerade as implemented features.

## 7. Product acceptance definition

An owner with a supported fresh VPS can install Cloudlane, securely claim ownership, sign in/out, create a project, deploy one static ZIP to an actually reachable HTTPS endpoint, view real job output, safely roll back a prior healthy release and administer the domain/service association. Subsequent modules meet their own specific acceptance tests in `docs/11-TESTING_AND_RELEASE.md`.
