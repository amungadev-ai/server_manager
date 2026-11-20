# 00 — Source of truth, scope and traceability

## Authority order

1. **Explicit locked decisions** from the Cloudlane planning conversations, restated here and recorded in `docs/13-ADR_AND_OPEN_DECISIONS.md`.
2. **Approved interactive UX:** `reference-cloudlane-v1.13.html` and the latest visual audit `source-blueprints/Cloudlane_UI_Refinement_and_Visual_Audit_v1.13.md`.
3. **Module blueprints:** domain UX v1.9, DNS architecture v1.8, storage v1.7, terminal v1.6, product charter v1.5, implementation blueprint v1.1, design integration v1.10.
4. **New technical proposals in this kit** where no older decision exists. These are clearly labeled **proposed** and need an ADR before security-sensitive implementation.
5. External vendor documentation as a guide to a supported implementation; never silently let changing upstream docs overturn agreed UX.

## Historical decisions and supersession notes

- Product charter v1.5 lists **Next.js**. The subsequent implementation decision changes the **dashboard** to **Svelte 5 + SvelteKit static output**. NestJS remains the API. This supersession affects dashboard technology only.
- Early v1.8 prototyped selecting Manual/Managed DNS **during** Add Domain. v1.9 explicitly supersedes that flow: **one-field Add Domain**; DNS selection only under **Domain → Settings**.
- Earlier blueprints targeted Ubuntu 20.04+. The current installation proposal favors **Ubuntu 24.04 LTS** as primary tested platform and **22.04 LTS** once validated; 20.04 is not an unrestricted production install target without maintenance arrangements.
- Cloudlane IP-first panel address and optional custom domain are explicitly locked. IP certificate support depends on network/CA/client capability and real testing, not on a prototype badge.
- The previously suggested managed-IP hostname fallback, such as `app.203-0-113-42.sslip.io`, is a **proposed optional preview fallback** (third-party DNS dependency), not a guaranteed production SLA. `app.203.0.113.42` is not a workable conventional DNS hostname.
- Cloudlane-branded nameservers (`ns1.cloudlane.app`, etc.) and Cloudlane-managed app hostnames remain **future services** until we operate actual infrastructure. `.example` domain strings in prototypes must never be used operationally.

## What has actually been built

| Asset | Truthful state |
| --- | --- |
| Cloudlane v1.13 standalone HTML | Interactive localStorage UI simulation, tested for major screen navigation |
| SvelteKit dashboard | Prototype parity corrected in PR #3; 40 direct screenshot comparisons and 32 browser cases pass. Resource actions remain memory-only simulation |
| NestJS API, PostgreSQL migrations, pg-boss | CL-030/031 add default-deny API guards, readiness and transactional PostgreSQL schema; exact checks in the batch evidence. Normal authentication, resource CRUD and pg-boss remain unavailable |
| Go agent and Docker provisioning | Not implemented yet |
| Installer and first-owner flow | Claim/owner/MFA development candidate in PR #5/#6; operational installer not implemented |
| Caddy public IP HTTPS / DNS / certificates | Planned and subject to live integration tests |
| Owner authentication | Isolated PostgreSQL/HTTPS candidate under ADR-019/020; normal activation disabled pending independent security review |
| GitHub webhook, storage, mail, DNS | Not implemented |
| Documentation and task/handoff templates | Prepared in this kit; not proof of running infrastructure |

## Files to consult for common questions

| Question | Original source |
| --- | --- |
| Product principles, navigation, create flows | `source-blueprints/Cloudlane_Product_Charter_and_Blueprint_v1.5.md` |
| Logical database and deployment state machine | `source-blueprints/Cloudlane_Implementation_Blueprint_v1.1.md` |
| Terminal, SQL console, SSH and privilege boundaries | `source-blueprints/Cloudlane_Access_and_Terminal_Blueprint_v1.6.md` |
| Storage, volumes, KYC, file separation | `source-blueprints/Cloudlane_Storage_and_File_Isolation_Blueprint_v1.7.md` |
| Manual vs authoritative managed DNS infrastructure | `source-blueprints/Cloudlane_DNS_Architecture_Blueprint_v1.8.md` |
| One-field Add Domain, Settings for DNS mode | `source-blueprints/Cloudlane_Domain_UX_Blueprint_v1.9.md` |
| Fonts, palette matrix and component sizes | `REFERENCE_DESIGN_SYSTEM.md`, `source-blueprints/Cloudlane_Design_System_Integration_v1.10.md` |
| Density and mobile refinements | `source-blueprints/Cloudlane_UI_Refinement_and_Visual_Audit_v1.13.md` |

## Evidence language

Use three separate labels in code reviews, docs and releases:

- **Locked product requirement:** explicitly accepted product behavior, even if not implemented.
- **Implementation proposal:** intended technical approach; may change with an ADR and tests.
- **Verified:** reproducible behavior in real code and a declared environment, with test evidence.

Agents must not copy the HTML's localStorage demo data persistence, fake credentials, or simulated activity events into the real production architecture. Treat the HTML as visual/behavioral reference only.

## Current implementation references

The initial pack inventory has been updated for the repository foundation. Exact progress/evidence lives in `tasks/progress/CL-001.md`, `CL-002.md` and `CL-003.md`. Package boundaries/review process: `docs/PACKAGE_BOUNDARIES.md` and `docs/adr/README.md`. Generated HTTP/agent schemas: `packages/contracts/`. Schema availability does not implement authentication, resource persistence or host operations. Only the attached consolidated guide and prototype were supplied; referenced historical blueprint files are not present and their contents have not been invented.

## API and persistence development batch

[CL-030/031 evidence](evidence/API_PERSISTENCE_BATCH.md) and [ADR-018](adr/018-api-persistence-foundations.md) describe the bounded API guard/database foundation in PR #4, stacked on the tested prototype conversion. These are development changes pending their recorded checks/review; no operational authentication, owner-claim exchange, installer or production service is implied. Canonical task records and PR checks identify current evidence.

## Isolated owner authentication candidate

[PR #5](https://github.com/amungadev-ai/server_manager/pull/5) prepares CL-032/033 under [ADR-019](adr/019-owner-auth-review-profile.md). It implements a concrete PostgreSQL/HTTPS development candidate with negative-path evidence. The normal API entry point keeps authentication disabled and the factory rejects production activation. Independent CL-005 review, installer/Caddy integration and real VPS acceptance remain open. MFA is now added by the later ADR-020 candidate below. See [the review evidence](evidence/OWNER_AUTH_REVIEW.md) and current PR checks for exact source scope.

## Mandatory MFA and authentication screens

[PR #6](https://github.com/amungadev-ai/server_manager/pull/6), [ADR-020](adr/020-mfa-recovery-and-auth-ui.md) and [batch evidence](evidence/MFA_AUTH_UI_REVIEW.md) extend the isolated development profile with mandatory TOTP/recovery challenges and separate Svelte auth routes. Password-only sessions are no longer accepted by this candidate. The static Site offers a read-only synthetic auth walkthrough; normal API activation stays disabled. Local root recovery is a documented installer contract, not an executable command. Independent security review and actual installer/TLS/VPS acceptance remain open.

## Authenticated project metadata

CL-036 in [PR #7](https://github.com/amungadev-ai/server_manager/pull/7) extends the isolated MFA profile with scoped project create/list/detail and overview metadata. [ADR-021](adr/021-authenticated-project-metadata.md) defines atomic production-environment creation, retry keys, pagination and session rechecks. [Batch evidence](evidence/AUTHENTICATED_PROJECTS.md) records checks and limits. The existing project form/list use the real API in HTTP builds; static demo actions stay simulated. Normal authentication, workload provisioning and production activation remain gated.
