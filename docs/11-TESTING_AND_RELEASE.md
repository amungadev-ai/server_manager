# 11 — Test strategy and release gates

## 1. Test pyramid and environments

| Layer | Scope | Mandatory evidence |
| --- | --- | --- |
| Unit | Svelte components/stores, NestJS policies/DTOs, DNS parsing, Go command validators | deterministic tests and coverage on critical modules |
| Integration | NestJS+Postgres/pg-boss, agent typed IPC, Caddy route generation, storage/DNS mock adapters | isolated real DB/queue, fail+retry assertions |
| End-to-end | desktop/mobile Svelte UI through real API against disposable VPS | actual rendered screens, auth boundaries, deployment stage transitions |
| Security | CSRF/session/MFA, cross-resource access, upload archive abuse, agent injection, SSRF, DNS takeover | negative cases with blocked operations |
| Resilience | restart during queue, OOM, low disk, DB outage, bad cert renewal, invalid migration | prior healthy state maintained, diagnosable failure |
| Upgrade/restore | fresh image, same-version repair, version upgrade, off-server restore | restored owner, services and access without data loss |
| Performance | 1vCPU/1GB/10GB target with idle/one-app loads | memory peak, OOM, disk and latency measurements, no unverified claim |

## 2. UI parity matrix

Check 1440×900, 950px, 700px, 390×844; five palettes × light/dark for key screens. Compare to v1.13 without blindly copying pixel positions. Audit keyboard tab order, screen-reader labels, color contrast, focus trapping and reduced motion.

- Overview: compact stats, inline recent activity, create menu, project cards, responsive no overflow.
- Projects: searchable compact tiles; full-card keyboard action; project detail Services/Architecture/Storage; mobile service detail cards.
- Domains: compact cards, add dialog has only domain name, exact seven tabs, Settings controls DNS mode, DNS Records contains verification and instructions.
- Settings: Workspace, Integrations, API Keys, Security, Server, Preferences and palette persistence.
- Applications: ZIP/GitHub flow, logs, history, terminal rules, domains, variables, artifacts/volumes.
- Databases, Email, Cron, Object Storage, Activity, server health: page states and navigation preserved.
- Assistant: floating 40/42px button, drag/click separated, accessible open/close and plan approval.

## 3. Installation and authentication acceptance

1. Signed installer preflight succeeds on supported fresh Ubuntu; incompatible/conflicted host fails with clear diagnosis without altering unrelated resources.
2. Same install rerun detects instance and repairs/resumes rather than creating duplicate DB/owner.
3. Public panel IP receives **publicly trusted** HTTPS where supported; certificate renewal is tested before short lifetime expires.
4. No owner setup form accepts secrets over public plaintext HTTP. Secure SSH tunnel fallback only.
5. One-time claim expires, is single-use, isn't logged and permits exactly one owner under concurrent attempts.
6. Password/session/MFA/recovery flows pass OWASP-aligned negative tests; all owner-only mutations reject anonymous and viewer roles.
7. Dashboard static assets load over HTTPS, all deep links work, API stays same-origin/private upstream.
8. Upon reboot API/DB/queue/agent/Caddy recover, owner data preserved. Off-server backup restore passes.

## 4. Deployment acceptance

1. ZIP from allowed archive accepted and indexed to immutable revision; traversal, symlink and zip-bomb attempts rejected.
2. Real build/release creates candidate; readiness checked before routing, health failures preserve last healthy active release.
3. Duplicate job/webhook/retry cannot deploy twice or cross service identities.
4. Logs show real sanitized stage updates; rollback to retained previous healthy release works.
5. Resource and network limits enforced on target VPS; low-resource case fails cleanly without killing control plane.
6. Backend APIs and static websites both deploy through same pipeline once relevant runtime adapters are supported.
7. App public URL is only marked working after DNS and HTTPS actual verification; IP-encoded preview hostnames are labeled best-effort unless managed by us.

## 5. Resource acceptance

- DB private by default, scoped user privilege checks, off-server backup/restore; SQL read-only console and TTL.
- Cron HTTP timing/timezone/retries, SSRF and overlap protections; execution history truthful.
- Domain ownership verification independent of local record edits; Manual and Managed DNS failures cannot masquerade as active.
- Storage private bucket and per-application grant boundaries; KYC access/revocation, expiry, audit; no arbitrary host file path.
- Application terminal short-lived, isolated, audited and unavailable to viewer; all OS/root commands blocked.
- Email transport explicitly external until real provider setup verified.

## 6. Release stages

| Stage | Intended audience | Gate |
| --- | --- | --- |
| `dev` | agent worktrees | lint/typecheck and feature tests; mock data allowed |
| `integration` | team disposable VMs | mainline integrated, migrations and end-to-end runs |
| `alpha` | self-hosting maintainers | secure owner login, first real HTTPS ZIP deploy and backup restore |
| `beta` | limited trusted operators | auth/installer/pipeline hardening, resource proofs, issue response process |
| `stable` | broad single-owner production | security review, signed reproducible release, docs, monitoring, recovery drills and known-limit disclosures |

No timeline or completion percentage is inferred from the HTML prototype. Each release requires a versioned test evidence manifest, risk list, unresolved blocker assessment and explicit decision owner.
