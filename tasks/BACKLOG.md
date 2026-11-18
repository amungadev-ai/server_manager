# Cloudlane implementation backlog — task-based and tool-neutral

**Reference:** Cloudlane v1.13 UI. **Starting status:** not-started for every task. No implementation is claimed by this documentation pack.

Every task is independently claimable by any authorized contributor. **Do not assign permanent worker identities to modules.** A live claim consists of a real branch and accepted claim/PR reference; inspect `tasks/progress/CL-###.md` before editing.

P0 = required for the secure first vertical slice; P1 = required before production release of the corresponding feature; P2 = post-core. Dependencies are gates, not hints.

## Phase 0 — standards and integration

| Task | Priority | Workstream | Dependencies | Measurable acceptance |
| --- | --- | --- | --- | --- |
| [`CL-001`](progress/CL-001.md) | P0 | Architecture & standards | — | Initialize Git repo/toolchain/monorepo; clean clone runs basic checks |
| [`CL-002`](progress/CL-002.md) | P0 | Architecture & standards | CL-001 | Adopt ADR process, package boundaries, source-of-truth docs and review ownership |
| [`CL-003`](progress/CL-003.md) | P0 | API, contracts & authentication | CL-001 | Define typed API/agent contracts, error envelopes, IDs and OpenAPI generation |
| [`CL-004`](progress/CL-004.md) | P0 | Installer, Go runtime & integration | CL-001 | Enable CI with progress gate, tests and branch protection checklist |
| [`CL-005`](progress/CL-005.md) | P0 | Architecture & standards | CL-003 | Security threat model for installer, bootstrap, API, agent and workload isolation reviewed |
| [`CL-006`](progress/CL-006.md) | P0 | Testing, security & release | CL-001 | CI unit/e2e test harness with desktop/mobile fixtures and evidence uploads |

## Phase 1 — Svelte dashboard / UX parity

| Task | Priority | Workstream | Dependencies | Measurable acceptance |
| --- | --- | --- | --- | --- |
| [`CL-010`](progress/CL-010.md) | P0 | Design system & frontend shell | CL-001 | Scaffold Svelte 5/SvelteKit static adapter build; output served without SSR process |
| [`CL-011`](progress/CL-011.md) | P0 | Design system & frontend shell | CL-010 | Apply Cloudlane tokens, 5 palettes, light/dark, Inter/mono, focus and reduced motion |
| [`CL-012`](progress/CL-012.md) | P0 | Design system & frontend shell | CL-011 | Sidebar/topbar/navigation/dialogs/toasts; accessible responsive shell |
| [`CL-013`](progress/CL-013.md) | P0 | Design system & frontend shell | CL-012 | Compact metric/project/domain base components; compare v1.13 screenshots |
| [`CL-014`](progress/CL-014.md) | P1 | Design system & frontend shell | CL-012 | Draggable 40/42px AI launcher; bounded drag/tap and persistence tests |
| [`CL-020`](progress/CL-020.md) | P0 | Workspace & projects | CL-012, CL-003 | Overview/Projects, search, creation, project detail; desktop/mobile parity |
| [`CL-021`](progress/CL-021.md) | P1 | Workspace & projects | CL-020 | Project Architecture and Storage contextual views with confirmed/suggested links |
| [`CL-022`](progress/CL-022.md) | P0 | API, contracts & authentication | CL-003, CL-010 | Demo/HTTP adapter interface and typed state/errors; no fake live success |
| [`CL-040`](progress/CL-040.md) | P0 | Domains & DNS | CL-012, CL-022 | Domain index, one-field Add Domain, seven tabs; mobile parity |
| [`CL-041`](progress/CL-041.md) | P0 | Domains & DNS | CL-040 | Manual/Managed selector ONLY under domain Settings; staged transition UI |
| [`CL-042`](progress/CL-042.md) | P1 | Domains & DNS | CL-041 | Domain hostname connections and verified selector UI, permission/empty/error states |
| [`CL-092`](progress/CL-092.md) | P0 | Testing, security & release | CL-020, CL-040 | Visual regression/a11y mobile & desktop for converted core UI |

## Phase 2 — real platform, installer and owner auth

| Task | Priority | Workstream | Dependencies | Measurable acceptance |
| --- | --- | --- | --- | --- |
| [`CL-030`](progress/CL-030.md) | P0 | API, contracts & authentication | CL-001, CL-003 | NestJS API skeleton with health/OpenAPI/error conventions, auth guards tests |
| [`CL-031`](progress/CL-031.md) | P0 | API, contracts & authentication | CL-030 | PostgreSQL migrations for install identity, users, sessions, workspace, project |
| [`CL-032`](progress/CL-032.md) | P0 | API, contracts & authentication | CL-031, CL-005 | Single-use atomic bootstrap claim with hashed TTL and race/replay tests |
| [`CL-033`](progress/CL-033.md) | P0 | API, contracts & authentication | CL-032 | Owner login, secure cookie/CSRF, logout, session rotation, rate limits; negative tests |
| [`CL-034`](progress/CL-034.md) | P0 | API, contracts & authentication | CL-033 | MFA/recovery codes and documented local owner recovery CLI contract, security review |
| [`CL-035`](progress/CL-035.md) | P0 | Design system & frontend shell | CL-032, CL-033, CL-012 | Claim/owner/MFA/login screens, API-backed and accessible, no public HTTP secrets |
| [`CL-036`](progress/CL-036.md) | P0 | API, contracts & authentication | CL-031, CL-033 | Authenticated project create/list; cross-workspace access negative tests |
| [`CL-080`](progress/CL-080.md) | P0 | Installer, Go runtime & integration | CL-001, CL-005 | Ubuntu 24.04 preflight/host conflict detection, signed versioned installer design |
| [`CL-081`](progress/CL-081.md) | P0 | Installer, Go runtime & integration | CL-080, CL-030 | Install Caddy/DB/API/static UI, install journal, resume/repair, systemd startup |
| [`CL-082`](progress/CL-082.md) | P0 | Installer, Go runtime & integration | CL-081 | Public-IP HTTPS issuance/renewal or secure SSH-tunnel fallback; live cert tests |
| [`CL-083`](progress/CL-083.md) | P0 | Installer, Go runtime & integration | CL-081, CL-032 | Installer claim printing, agent identity, installation health and safe fail state |
| [`CL-084`](progress/CL-084.md) | P0 | Installer, Go runtime & integration | CL-083 | Reboot, repair, interrupted install and uninstall dry-run tests |
| [`CL-093`](progress/CL-093.md) | P0 | Testing, security & release | CL-034, CL-083 | Owner claim/password/session/MFA adversarial tests; no public plaintext path |

## Phase 3 — real deployment spine

| Task | Priority | Workstream | Dependencies | Measurable acceptance |
| --- | --- | --- | --- | --- |
| [`CL-050`](progress/CL-050.md) | P0 | Deployments & application hosting | CL-030, CL-036 | Secure ZIP staging/finalization incl traversal, symlink and quota tests |
| [`CL-051`](progress/CL-051.md) | P0 | Deployments & application hosting | CL-050 | Deployment/job/state events, queue retries/idempotency, SSE progress |
| [`CL-052`](progress/CL-052.md) | P0 | Installer, Go runtime & integration | CL-005, CL-081 | Go typed agent command IPC; rejects generic host shell and unsafe mounts |
| [`CL-053`](progress/CL-053.md) | P0 | Deployments & application hosting | CL-051, CL-052 | Static ZIP candidate build/start/health check; atomic Caddy promotion, rollback |
| [`CL-054`](progress/CL-054.md) | P0 | Deployments & application hosting | CL-053 | Svelte app lifecycle views wired to actual API logs/history/deploy errors |
| [`CL-055`](progress/CL-055.md) | P1 | Deployments & application hosting | CL-051 | GitHub App scoped install, revision pinning, signed webhook and replay tests |
| [`CL-056`](progress/CL-056.md) | P1 | Deployments & application hosting | CL-053, CL-055 | Node/Next.js/Express runtime adapters and env secret injection protections |
| [`CL-094`](progress/CL-094.md) | P0 | Testing, security & release | CL-053 | Failure injection, rollback, low-RAM/OOM, malicious ZIP and concurrency tests |

## Phase 4 — domains and production resources

| Task | Priority | Workstream | Dependencies | Measurable acceptance |
| --- | --- | --- | --- | --- |
| [`CL-043`](progress/CL-043.md) | P1 | Domains & DNS | CL-031, CL-041 | Public DNS TXT ownership verification and conflict-safe bindings, authoritative checks |
| [`CL-044`](progress/CL-044.md) | P1 | Domains & DNS | CL-043, CL-082 | Domain base/subdomain routing, custom TLS/ACME monitoring, atomic Caddy routes |
| [`CL-045`](progress/CL-045.md) | P2 | Domains & DNS | CL-044 | Managed DNS integration with real redundant authoritative nameservers; no fake activation |
| [`CL-060`](progress/CL-060.md) | P1 | Databases, cron & server | CL-052, CL-031 | Database provisioning, private network, scoped users/privileges and backups |
| [`CL-061`](progress/CL-061.md) | P1 | Databases, cron & server | CL-051, CL-031 | Cron HTTP scheduling, timezone/overlap/retry/SSRF protection, run history |
| [`CL-062`](progress/CL-062.md) | P1 | Databases, cron & server | CL-081 | Server metrics, installation health and SSH guidance without host terminal |
| [`CL-063`](progress/CL-063.md) | P2 | Databases, cron & server | CL-060 | Read-only authorized DB SQL console with timeout and result limits |
| [`CL-070`](progress/CL-070.md) | P1 | Storage & email | CL-003, CL-031 | External S3 provider connections, private buckets, object metadata and quotas |
| [`CL-071`](progress/CL-071.md) | P1 | Storage & email | CL-070 | Scoped per-service bucket grants, audit, signed upload/download intent controls |
| [`CL-072`](progress/CL-072.md) | P1 | Storage & email | CL-070 | Bucket/prefix file browser, safe previews, KYC classification/retention UX |
| [`CL-073`](progress/CL-073.md) | P1 | Storage & email | CL-031 | Email index/domain Email + provider integration; MX/DKIM/SPF/DMARC continuity |
| [`CL-074`](progress/CL-074.md) | P1 | Storage & email | CL-052, CL-070 | Immutable artifact manifest and named volume allocations, no host paths |

## Phase 5 — hardening, upgrade and release

| Task | Priority | Workstream | Dependencies | Measurable acceptance |
| --- | --- | --- | --- | --- |
| [`CL-085`](progress/CL-085.md) | P0 | Installer, Go runtime & integration | CL-081, CL-031 | Platform encrypted off-server backup and actual restore on clean test VPS |
| [`CL-086`](progress/CL-086.md) | P0 | Installer, Go runtime & integration | CL-085, CL-083 | Safe upgrade/migration with installation identity and previous version checks |
| [`CL-087`](progress/CL-087.md) | P0 | Installer, Go runtime & integration | CL-082, CL-053 | Resource admission, log/image pruning and renewal monitoring in starter profile |
| [`CL-090`](progress/CL-090.md) | P0 | Testing, security & release | CL-006 | Security test matrix, OWASP-derived cases and adversarial API/agent tests |
| [`CL-091`](progress/CL-091.md) | P0 | Testing, security & release | CL-085, CL-086 | End-to-end fresh install, recovery, benchmark and release evidence manifest |
| [`CL-095`](progress/CL-095.md) | P1 | Testing, security & release | CL-091 | Cross-browser/a11y/palette/390px regression and documented design sign-off |
| [`CL-096`](progress/CL-096.md) | P1 | Architecture & standards | CL-091 | Public release readiness signoff, support/incident runbooks and scope disclosure |

## Definition of done

- The implementation is committed, reviewed, and merged if relevant. A task can be `merged` without yet being `verified`.
- The associated `tasks/progress/CL-###.md` has **real** branch, last commit, changed files, exact verification commands, failures, and the next action.
- Security-sensitive work requires separate negative-path testing and review.
- Integration status is consolidated into `PROJECT_PROGRESS.md` only after evidence is reviewed.

## Claim and takeover

1. Inspect the task progress file and current remote refs/PRs before claiming.
2. Coordinate a **single canonical branch/claim** per task using a shared repository or issue/PR claim mechanism. Local edits alone do not reserve a task.
3. Take over on the existing branch when possible. Preserve history and prior test results; append a new checkpoint.
4. If an old branch is unreachable, record that fact, the last available commit, and the precise recovery approach before starting a replacement branch.
5. Run `python3 scripts/taskboard.py list` to see the work queue.
