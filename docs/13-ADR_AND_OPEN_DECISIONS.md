# 13 — Architecture decision register and unresolved questions

Decisions are marked **LOCKED**, **PROPOSED**, or **OPEN**. An explicit product agreement is not itself evidence of production implementation.

## Locked product decisions

| ID | Decision | Reason / consequence |
| --- | --- | --- |
| ADR-001 | Single-owner, single self-hosted VPS first | Lower setup complexity; multi-tenant public hosting deferred |
| ADR-002 | Svelte 5 + SvelteKit static dashboard; NestJS API | Separate lightweight UI delivery from backend operations; supersedes Next.js dashboard in v1.5 charter |
| ADR-003 | PostgreSQL + pg-boss, no mandatory Redis | Fewer always-on dependencies on starter VPS |
| ADR-004 | Go restricted agent, Docker workloads and Caddy ingress | Explicit privileged/unprivileged boundary; no browser host shell |
| ADR-005 | IP-first **HTTPS** dashboard; domain optional, SSH tunnel fallback | Truly domain-free install without insecure public owner setup |
| ADR-006 | One-field Add Domain; Manual DNS default; DNS mode in domain Settings | Frictionless domain onboarding; one canonical registry |
| ADR-007 | Managed DNS optional, requires multiple real independent authoritative nameservers | Reliability and correctness of registrar delegation |
| ADR-008 | Exactly seven domain detail tabs | Preserve established UI and scope |
| ADR-009 | Immutable releases, scoped storage buckets, named volumes, no host file UI | Safe separation of application vs host resources |
| ADR-010 | Cloudlane v1.13 interface and design-system palettes as baseline | Avoid unrequested redesign during migration |
| ADR-011 | ZIP + GitHub use one deployment engine; AI proposals need approval | Consistent infra operation/auditing |

## Proposed implementation decisions awaiting validation

| ID | Proposal | Validation / owner |
| --- | --- | --- |
| ADR-P01 | Dashboard SPA static fallback served by Caddy; same-origin API | design system & frontend shell workstream/08/10 deep-link and cookie tests |
| ADR-P02 | `/api/v1` canonical prefix instead of older `/v1` sketch | Adopted for development by `docs/adr/014-contracts-and-generation.md`; route/generation tests recorded in CL-003 |
| ADR-P03 | Password + TOTP/recovery codes initial owner auth, with passkey extension later | api, contracts & authentication workstream/09 security review; UX decision on MFA enforcement |
| ADR-P04 | Opaque server-stored sessions, HttpOnly/Secure cookies, CSRF+Origin checks | api, contracts & authentication workstream/09 browser/IP/custom-host tests |
| ADR-P05 | Local UNIX socket for authenticated API-to-agent channel | installer, go runtime & integration workstream/01 threat-model, upgrade and privilege tests |
| ADR-P06 | Platform services deployed as signed prebuilt OCI images and static assets | installer, go runtime & integration workstream reproducibility/resource tests |
| ADR-P07 | HTTPS IP certificate via compatible Caddy/ACME client with automated short-lived renewal | installer, go runtime & integration workstream live VPS test, certificate expiry monitoring |
| ADR-P08 | 1GB starter worker queue concurrency 1 with off-host build preference | testing, security & release workstream/10 measured memory/disk benchmarks |
| ADR-P09 | Experimental IP-encoded `sslip.io` app preview only | domains & dns workstream assess dependency/rate limits; no SLA |

## Open questions to resolve before implementing dependent work

1. **MFA policy:** mandatory at first claim, mandatory for admin actions only, or prompted strongly? Proposed: require MFA enrollment/recovery before ACTIVE; security review needed.
2. **Starter resources:** measured RAM/disk breakdown and minimum usable free space; cannot claim 1GB/10GB without data.
3. **Install distribution:** release signing standard, binary vs package/OCI, supported CPU architectures, update channels.
4. **Trusted IP cert:** tested ACME/Caddy version, short-lived profile config, IPv6, renewal retry and plan when 80/443 inaccessible.
5. **Default app URLs before custom base:** experimental third-party `sslip.io` vs safe “not publicly routed” until a base domain; future Cloudlane-managed DNS dependency.
6. **Storage provider selection and credential policy:** choose initial external S3-compatible backend, retention and encrypted key backup approach.
7. **External email:** supported provider for first release; real mailbox creation may not be universally available without provider APIs.
8. **Backups and RPO/RTO:** backup backend, pricing, key escrow, restore targets; don't claim automated recovery without drills.
9. **Public multi-tenant future:** build isolation stronger than baseline Docker; intentionally out of MVP.
10. **Managed DNS service:** operator/legal and operational plan for independent authoritative nameservers; cannot be faked by the user VPS.

## ADR format (for new decisions)

```markdown
# ADR-XXX: Title
Status: proposed | accepted | superseded
Date: YYYY-MM-DD
Owner: task claimant / reviewer
Context: observed need, known constraints and evidence
Decision: what changes, where, why
Alternatives considered: A, B, C and downsides
Security/resource implications: explicit
Compatibility/migration: old data and routes
Acceptance evidence: tests or benchmark names
Links: task ID, PR, original blueprint
```

Do not silently change a locked UX principle in a feature PR. Propose ADR and seek user/lead review.

## Repository implementation decisions

See `docs/adr/README.md` for ADR-013 (package/review boundaries), ADR-014 (draft HTTP schemas and generation), and proposed ADR-015 (non-executing agent envelope). Original locked product decisions remain authoritative. No session/MFA/agent cryptographic/security proposal is approved by merely generating a contract.
