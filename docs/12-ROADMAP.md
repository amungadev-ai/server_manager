# 12 — Dependency-first implementation roadmap (contributor-neutral)

The plan is organized by **task and workstream**, not permanent worker identities. Any authorized contributor can claim any ready task after checking dependencies and current remote claims. Concurrency is limited by shared contracts, not by how many tools or people are available.

## Workstreams and interface boundaries

| Workstream | Scope | Files or packages expected after scaffolding | Examples of task IDs |
| --- | --- | --- | --- |
| Architecture & standards | Repository conventions, ADRs, threat models, API/agent boundaries | `docs/`, `packages/contracts` | CL-001, CL-002, CL-003, CL-005 |
| Design system & Svelte shell | SvelteKit static build, tokens, shell, reusable UI and theme | `apps/dashboard/`, design tokens | CL-010–CL-014, CL-035 |
| Workspace & projects | Overview, projects, environment/project architecture | Dashboard feature routes | CL-020, CL-021 |
| Domains & DNS | Registry, seven tabs, DNS/settings, public TLS | Dashboard domain routes, DNS API | CL-040–CL-045 |
| Applications & deployments | ZIP, builds, GitHub, logs/rollback | Deployment API and dashboard routes | CL-050–CL-056 |
| Infrastructure resources | Databases, cron, server and SQL console | API resources, dashboard views | CL-060–CL-063 |
| Storage & email | Object files and bucket grants, volumes/artifacts, email | Resource APIs, UI | CL-070–CL-074 |
| Platform API & authentication | NestJS, migrations, sessions, owner claim, typed adapters | `apps/api/`, `packages/contracts` | CL-030–CL-036 |
| Testing & assurance | CI harness, visual/security, failure/restore and benchmarks | `tests/`, CI | CL-006, CL-090–CL-096 |
| Installer & Go agent | Ubuntu preflight, install stages, IP HTTPS, typed agent and updates | `installer/`, `agent/`, deployment tooling | CL-080–CL-087 |

These rows indicate technical areas, **not assignments**. Claim tasks through `tasks/progress/CL-###.md` and remote coordination. Avoid overlapping shared files without explicit review.

## Dependency-first phases

### Phase 0 — repository, contracts and handoff discipline

Establish Git repository, package manager/toolchain, schema and API contract conventions, ADRs, tests and the task progress gate. Begin with `CL-001`; sequence `CL-002/003/004/006` according to the backlog. **Exit:** fresh checkout can run documented checks; basic API/dashboard skeleton builds; handoff validation passes.

### Phase 1 — approved SvelteKit UI

Implement static SPA build, design tokens/components, mock/API adapter and Overview/Projects/Domains with v1.13 mobile/desktop parity. **Exit:** deployable static assets without SSR process, documented parity tests and no demo-to-live false status claims.

### Phase 2 — installer and secure first-run owner setup

Create versioned Ubuntu preflight/installer, Caddy public-IP certificate flow, secure owner-claim flow, real authenticated session, MFA/recovery, Go identity and repair/reboot tests. Contracts must be agreed before installer/auth implementation proceeds in parallel. **Exit:** fresh disposable VPS can be installed, claimed via trusted HTTPS (or documented secure SSH-local fallback), signed in and restarted without losing owner identity.

### Phase 3 — first real static ZIP deployment

Create API upload/storage, persistent queue, typed agent command interface, isolated runtime, Caddy route, health checks, logs and automatic rollback. **Exit:** healthy ZIP release works; failed candidate leaves previous working release untouched.

### Phase 4 — custom domains, GitHub and managed resources

Implement domain ownership proof, custom HTTPS, GitHub pipelines, databases, cron and scoped external object storage/email integrations. Cloudlane Managed DNS must remain unavailable until independent real authoritative DNS infrastructure is operating and verified.

### Phase 5 — reliability, upgrades and release

Document and test off-server backup/restore, safe upgrades, resource limits, certificate renewal, security negative paths, accessibility/mobile and small-VPS benchmarks. No production readiness claim without actual evidence.

## Coordination without identity-dependent ownership

- Use the backlog's stable task IDs as the sole assignment keys.
- Establish one accepted active claim/branch per task; takeovers keep the **same task file** and preserve all history.
- Use typed schema tests/contract PRs to let independent modules proceed in parallel.
- Do not let a dependency marked `not-started` or `blocked` count as complete just because UI mocks exist.
- Require PRs that change implementation to update `tasks/progress/CL-###.md` with factual evidence.
- The contributor who integrates reviewed work updates `PROJECT_PROGRESS.md` with merged SHA/test evidence.

## Start order

Start with `CL-001`. As it is integrated, follow the dependency graph in `tasks/BACKLOG.md`. The first full vertical slice to demonstrate is **Ubuntu preflight → trusted IP HTTPS → first-owner claim → authenticated static dashboard → real ZIP deployment**.
